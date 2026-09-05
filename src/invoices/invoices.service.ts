import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { ConfirmPaymentDto, RejectPaymentDto } from './dto/review-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { InvoiceTimeFilterType, QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryPaymentRequestsDto } from './dto/query-payment-requests.dto';
import { buildPaginatedResult, calculatePagination } from '../common/utils/pagination.util';
import {
  PaymentEntryStatus,
  PaymentEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import {
  collectedRevenueWhere,
  endOfDay,
  formatLocalDate,
  roundMoney,
  startOfDay,
} from '../common/utils/revenue.util';

/** Quan hệ cần nạp kèm để dựng đủ response hóa đơn cho FE. */
const INVOICE_INCLUDE = {
  booking: {
    include: {
      customer: { select: { id: true, fullName: true, phone: true, email: true } },
      room: { select: { roomNumber: true } },
      serviceOrders: true,
    },
  },
  issuedBy: { select: { fullName: true, email: true, role: true } },
  payments: {
    include: {
      createdBy: { select: { id: true, fullName: true, role: true } },
      confirmedBy: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tính lại `paidAmount` / `paymentStatus` / `paidAt` của hóa đơn từ sổ thu tiền.
   *
   * Đây là NƠI DUY NHẤT được phép đổi số tiền đã thu của hóa đơn. Mọi nghiệp vụ
   * (thu tại quầy, khách trả qua app, hoàn tiền, check-out) chỉ ghi thêm một dòng
   * vào bảng `payments` rồi gọi hàm này, nên tổng tiền không bao giờ lệch với
   * lịch sử giao dịch.
   *
   * Public vì `BookingsService.checkOut` cũng phải chốt lại hóa đơn trong cùng
   * transaction với việc đổi trạng thái đơn và phòng.
   */
  async recalculateInvoiceTotals(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { finalAmount: true, paymentMethod: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${invoiceId}`);
    }

    const entries = await tx.payment.findMany({
      where: { invoiceId, status: PaymentEntryStatus.CONFIRMED },
      orderBy: { confirmedAt: 'asc' },
    });

    let collected = 0;
    let refunded = 0;
    let lastPaidAt: Date | null = null;
    let lastMethod: PaymentMethod = invoice.paymentMethod;

    for (const entry of entries) {
      if (entry.type === PaymentEntryType.REFUND) {
        refunded += entry.amount;
      } else {
        // PAYMENT và DEPOSIT đều là tiền đã vào két
        collected += entry.amount;
        lastMethod = entry.method;
      }
      const stamp = entry.confirmedAt ?? entry.createdAt;
      if (!lastPaidAt || stamp > lastPaidAt) {
        lastPaidAt = stamp;
      }
    }

    const paidAmount = roundMoney(collected - refunded);

    let paymentStatus: PaymentStatus;
    if (paidAmount <= 0) {
      // Đã thu rồi hoàn lại hết là REFUNDED; chưa thu đồng nào là UNPAID.
      paymentStatus = refunded > 0 ? PaymentStatus.REFUNDED : PaymentStatus.UNPAID;
    } else if (paidAmount >= roundMoney(invoice.finalAmount)) {
      paymentStatus = PaymentStatus.PAID;
    } else {
      paymentStatus = PaymentStatus.PARTIAL;
    }

    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount,
        paymentStatus,
        paymentMethod: lastMethod,
        paidAt: paidAmount > 0 ? lastPaidAt : null,
      },
      include: INVOICE_INCLUDE,
    });
  }

  /**
   * Helper ánh xạ và bổ sung các trường hiển thị theo yêu cầu FE (Mục 04)
   */
  private toInvoiceResponse(invoice: any) {
    const customer = invoice.booking?.customer;
    const room = invoice.booking?.room;
    const serviceOrders = invoice.booking?.serviceOrders || [];
    const ledger = invoice.payments || [];

    // Tạo danh sách items chi tiết (tiền phòng + từng dịch vụ phụ trợ)
    const items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }> = [];

    if (invoice.roomAmount > 0) {
      items.push({
        name: `Tiền thuê phòng ${room?.roomNumber ? `P.${room.roomNumber}` : ''}`.trim(),
        quantity: 1,
        unitPrice: invoice.roomAmount,
        amount: invoice.roomAmount,
      });
    }

    for (const s of serviceOrders) {
      items.push({
        name: s.serviceName,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.totalPrice,
      });
    }

    // Lịch sử thu tiền có thật, lấy từ sổ thu tiền thay vì suy ra từ số tổng
    const payments = ledger
      .filter((p: any) => p.status === PaymentEntryStatus.CONFIRMED)
      .map((p: any) => ({
        id: p.id,
        amount: p.type === PaymentEntryType.REFUND ? -p.amount : p.amount,
        type: p.type,
        paymentMethod: p.method,
        paidAt: p.confirmedAt ?? p.createdAt,
        reference: p.reference,
        note: p.note,
        cashierName: p.confirmedBy?.fullName || invoice.issuedBy?.fullName || 'Thu ngân ca trực',
      }));

    // Yêu cầu khách đã gửi nhưng thu ngân chưa đối chiếu xong
    const pendingPayments = ledger
      .filter((p: any) => p.status === PaymentEntryStatus.PENDING)
      .map((p: any) => ({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.method,
        reference: p.reference,
        note: p.note,
        requestedAt: p.createdAt,
        requestedByName: p.createdBy?.fullName || customer?.fullName || null,
      }));

    const finalAmount = roundMoney(invoice.finalAmount);
    const paidAmount = roundMoney(invoice.paidAmount);
    const remainingAmount = Math.max(0, finalAmount - paidAmount);
    const pendingAmount = roundMoney(
      pendingPayments.reduce((sum: number, p: any) => sum + p.amount, 0),
    );

    return {
      ...invoice,
      payments,
      pendingPayments,
      roomNumber: room?.roomNumber || 'N/A',
      customerName: customer?.fullName || 'Khách vãng lai',
      customerPhone: customer?.phone || null,
      items,

      // Tiền cọc đã thu lúc lễ tân duyệt đơn (đã nằm trong paidAmount)
      depositAmount: roundMoney(invoice.booking?.depositAmount || 0),
      /** Số tiền khách còn phải trả — FE dùng trực tiếp cho dòng "Còn thiếu". */
      remainingAmount,
      /** Tổng các yêu cầu thanh toán đang chờ thu ngân xác nhận. */
      pendingAmount,
      hasPendingPaymentRequest: pendingPayments.length > 0,
      /** Khách chỉ được bấm thanh toán khi còn nợ và chưa có yêu cầu nào treo. */
      canRequestPayment: remainingAmount > 0 && pendingPayments.length === 0,
    };
  }

  /**
   * Tính toán khoảng thời gian lọc hóa đơn:
   * - Lễ tân (Receptionist) hoặc mặc định: Chỉ được xem theo tuần (Thứ 2 - CN).
   * - Admin: Được phép chọn khoảng tháng (fromMonth - toMonth), theo năm (year), hoặc theo ngày tùy chọn.
   */
  private resolveInvoiceTimeFilter(
    query: QueryInvoicesDto,
    userRole?: Role,
  ): {
    filterType: InvoiceTimeFilterType;
    startDate: Date;
    endDate: Date;
    label: string;
  } {
    const isExplicitNonAdmin = Boolean(userRole && userRole !== Role.ADMIN);
    const hasAdminFilter = Boolean(
      query.fromMonth ||
      query.toMonth ||
      query.year ||
      query.month ||
      query.startDate ||
      query.endDate ||
      (query.filterType && query.filterType !== InvoiceTimeFilterType.WEEK),
    );

    if (isExplicitNonAdmin && hasAdminFilter) {
      throw new ForbiddenException(
        'Lễ tân chỉ có quyền tra cứu hóa đơn theo tuần. Bộ lọc theo tháng hoặc năm chỉ dành cho Quản trị viên (Admin).',
      );
    }

    const now = new Date();

    // Xác định loại filter:
    let filterType = query.filterType;
    if (!filterType) {
      if (query.fromMonth || query.toMonth || query.month) {
        filterType = InvoiceTimeFilterType.MONTH_RANGE;
      } else if (query.year) {
        filterType = InvoiceTimeFilterType.YEAR;
      } else if (query.startDate || query.endDate) {
        filterType = InvoiceTimeFilterType.CUSTOM;
      } else {
        filterType = InvoiceTimeFilterType.WEEK;
      }
    }

    // 1. Khoảng tháng (Month range)
    if (filterType === InvoiceTimeFilterType.MONTH_RANGE) {
      const targetYear = query.year ? Number(query.year) : now.getFullYear();
      const fromM = Number(query.fromMonth || query.month || 1);
      const toM = Number(query.toMonth || query.month || fromM);
      const actualFrom = Math.min(Math.max(1, fromM), 12);
      const actualTo = Math.min(Math.max(1, toM), 12);
      const minMonth = Math.min(actualFrom, actualTo);
      const maxMonth = Math.max(actualFrom, actualTo);

      const startDate = new Date(targetYear, minMonth - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(targetYear, maxMonth, 0, 23, 59, 59, 999);
      const label =
        minMonth === maxMonth
          ? `Tháng ${minMonth}/${targetYear}`
          : `Từ T${minMonth} đến T${maxMonth}/${targetYear}`;

      return { filterType, startDate, endDate, label };
    }

    // 2. Cả năm (Year)
    if (filterType === InvoiceTimeFilterType.YEAR) {
      const targetYear = query.year ? Number(query.year) : now.getFullYear();
      const startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      const label = `Năm ${targetYear}`;
      return { filterType, startDate, endDate, label };
    }

    // 3. Tùy biến ngày (Custom)
    if (filterType === InvoiceTimeFilterType.CUSTOM && (query.startDate || query.endDate)) {
      const startDate = query.startDate ? startOfDay(new Date(query.startDate)) : startOfDay(now);
      const endDate = query.endDate ? endOfDay(new Date(query.endDate)) : endOfDay(now);
      const label = `${formatLocalDate(startDate)} - ${formatLocalDate(endDate)}`;
      return { filterType, startDate, endDate, label };
    }

    // 4. Theo tuần (Week - Mặc định cho Lễ tân và Admin khi không truyền tháng/năm)
    const offset = Number(query.weekOffset || 0);
    const baseDate = new Date(now);
    if (offset !== 0) {
      baseDate.setDate(baseDate.getDate() + offset * 7);
    }

    const day = baseDate.getDay(); // 0 = Chủ nhật, 1 = Thứ hai
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const label =
      offset === 0
        ? `Tuần này (${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')} - ${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}/${sunday.getFullYear()})`
        : `Tuần ${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')} - ${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}/${sunday.getFullYear()}`;

    return {
      filterType: InvoiceTimeFilterType.WEEK,
      startDate: monday,
      endDate: sunday,
      label,
    };
  }

  async findAll(
    queryOrStatus?: QueryInvoicesDto | PaymentStatus,
    userRole?: Role,
  ) {
    const query: QueryInvoicesDto =
      typeof queryOrStatus === 'string'
        ? { status: queryOrStatus }
        : (queryOrStatus ?? {});

    const timeFilter = this.resolveInvoiceTimeFilter(query, userRole);

    const where: Prisma.InvoiceWhereInput = {};
    if (query.status) {
      where.paymentStatus = query.status;
    }

    const conditions: Prisma.InvoiceWhereInput[] = [
      {
        OR: [
          { createdAt: { gte: timeFilter.startDate, lte: timeFilter.endDate } },
          { paidAt: { gte: timeFilter.startDate, lte: timeFilter.endDate } },
        ],
      },
    ];

    if (query.search) {
      const search = query.search.trim();
      const insensitive = 'insensitive' as const;
      conditions.push({
        OR: [
          { invoiceCode: { contains: search, mode: insensitive } },
          { booking: { customer: { fullName: { contains: search, mode: insensitive } } } },
          { booking: { customer: { phone: { contains: search, mode: insensitive } } } },
          { booking: { customer: { email: { contains: search, mode: insensitive } } } },
          { booking: { room: { roomNumber: { contains: search, mode: insensitive } } } },
        ],
      });
    }

    where.AND = conditions;

    const { isPaginated, page, limit, skip, take } = calculatePagination(query);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take } : {}),
      }),
    ]);

    const data = list.map((inv) => this.toInvoiceResponse(inv));
    const paginated = buildPaginatedResult(
      data,
      total,
      isPaginated ? page : undefined,
      isPaginated ? limit : undefined,
    );

    return {
      ...paginated,
      meta: {
        ...paginated.meta,
        timeFilter: {
          type: timeFilter.filterType,
          startDate: timeFilter.startDate.toISOString(),
          endDate: timeFilter.endDate.toISOString(),
          label: timeFilter.label,
        },
      },
    };
  }

  /**
   * Hóa đơn của chính khách hàng đang đăng nhập (màn "Hóa đơn của tôi").
   * Lọc theo chủ đơn đặt phòng, khách không bao giờ thấy hóa đơn của người khác.
   */
  async findMyInvoices(customerId: string, queryOrStatus?: QueryInvoicesDto | PaymentStatus) {
    const query: QueryInvoicesDto =
      typeof queryOrStatus === 'string'
        ? { status: queryOrStatus }
        : (queryOrStatus ?? {});

    const where: Prisma.InvoiceWhereInput = {
      booking: { customerId },
      ...(query.status ? { paymentStatus: query.status } : {}),
    };

    if (query.search) {
      const search = query.search.trim();
      const insensitive = 'insensitive' as const;
      where.OR = [
        { invoiceCode: { contains: search, mode: insensitive } },
        { booking: { room: { roomNumber: { contains: search, mode: insensitive } } } },
      ];
    }

    const { isPaginated, page, limit, skip, take } = calculatePagination(query);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take } : {}),
      }),
    ]);

    const data = list.map((inv) => this.toInvoiceResponse(inv));
    return buildPaginatedResult(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
  }

  async findOne(id: string, currentUserId?: string, currentUserRole?: Role) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
    }

    // Khách hàng chỉ mở được hóa đơn thuộc đơn đặt phòng của chính mình.
    if (
      currentUserRole === Role.CUSTOMER &&
      invoice.booking?.customerId !== currentUserId
    ) {
      throw new ForbiddenException(
        'Bạn chỉ có thể xem hóa đơn thuộc đơn đặt phòng của chính mình',
      );
    }

    return this.toInvoiceResponse(invoice);
  }

  /**
   * Thu ngân thu tiền trực tiếp tại quầy (S2 - P1).
   * Ghi thẳng một dòng CONFIRMED vào sổ thu tiền vì tiền đã vào két ngay lúc đó.
   */
  async recordPayment(id: string, dto: RecordPaymentDto, cashierId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, finalAmount: true, paidAmount: true, paymentStatus: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Số tiền thu phải lớn hơn 0');
    }

    const remaining = Math.max(
      0,
      roundMoney(invoice.finalAmount) - roundMoney(invoice.paidAmount),
    );

    if (remaining <= 0) {
      throw new BadRequestException('Hóa đơn này đã được thanh toán đủ toàn bộ');
    }

    if (roundMoney(dto.amount) > remaining) {
      throw new BadRequestException(
        `Số tiền thu (${dto.amount.toLocaleString('vi-VN')}đ) vượt quá số còn phải thu ` +
          `(${remaining.toLocaleString('vi-VN')}đ). Nếu khách trả dư, hãy thu đúng số còn lại và trả lại tiền thừa.`,
      );
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: id,
          amount: roundMoney(dto.amount),
          method: dto.paymentMethod,
          type: PaymentEntryType.PAYMENT,
          status: PaymentEntryStatus.CONFIRMED,
          note: dto.notes,
          createdById: cashierId,
          confirmedById: cashierId,
          confirmedAt: now,
        },
      });

      if (dto.notes) {
        const current = await tx.invoice.findUnique({
          where: { id },
          select: { notes: true },
        });
        await tx.invoice.update({
          where: { id },
          data: {
            notes: `${current?.notes || ''}\n${dto.notes}`.trim(),
            issuedById: cashierId,
          },
        });
      } else {
        await tx.invoice.update({ where: { id }, data: { issuedById: cashierId } });
      }

      return this.recalculateInvoiceTotals(tx, id);
    });

    return this.toInvoiceResponse(updated);
  }

  /**
   * Khách hàng bấm "Thanh toán" trên app.
   *
   * Không cộng tiền ngay — chỉ tạo một yêu cầu PENDING để thu ngân đối chiếu.
   * Bỏ trống `amount` nghĩa là khách trả toàn bộ số còn lại.
   */
  async createPaymentRequest(
    id: string,
    dto: CreatePaymentRequestDto,
    userId: string,
    userRole: Role,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: { select: { customerId: true } },
        payments: { where: { status: PaymentEntryStatus.PENDING } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
    }

    if (userRole === Role.CUSTOMER && invoice.booking?.customerId !== userId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể thanh toán hóa đơn thuộc đơn đặt phòng của chính mình',
      );
    }

    const remaining = Math.max(
      0,
      roundMoney(invoice.finalAmount) - roundMoney(invoice.paidAmount),
    );

    if (remaining <= 0) {
      throw new BadRequestException('Hóa đơn này đã được thanh toán đủ, không cần trả thêm');
    }

    if (invoice.payments.length > 0) {
      const pending = roundMoney(
        invoice.payments.reduce((sum, p) => sum + p.amount, 0),
      );
      throw new BadRequestException(
        `Bạn đang có yêu cầu thanh toán ${pending.toLocaleString('vi-VN')}đ chờ lễ tân xác nhận. ` +
          'Vui lòng đợi lễ tân đối chiếu xong hoặc hủy yêu cầu cũ trước khi tạo yêu cầu mới.',
      );
    }

    // Không truyền amount = trả hết phần còn lại (đúng nút "Thanh toán toàn bộ")
    const amount = dto.amount !== undefined ? roundMoney(dto.amount) : remaining;

    if (amount > remaining) {
      throw new BadRequestException(
        `Số tiền thanh toán (${amount.toLocaleString('vi-VN')}đ) vượt quá số còn lại của hóa đơn ` +
          `(${remaining.toLocaleString('vi-VN')}đ)`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: id,
        amount,
        method: dto.paymentMethod,
        type: PaymentEntryType.PAYMENT,
        status: PaymentEntryStatus.PENDING,
        reference: dto.reference,
        note: dto.note,
        createdById: userId,
      },
    });

    const refreshed = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });

    return {
      message:
        amount >= remaining
          ? 'Đã gửi yêu cầu thanh toán toàn bộ số tiền còn lại. Lễ tân sẽ xác nhận sau khi đối chiếu.'
          : 'Đã gửi yêu cầu thanh toán. Lễ tân sẽ xác nhận sau khi đối chiếu.',
      paymentId: payment.id,
      amount,
      remainingAfterConfirm: Math.max(0, remaining - amount),
      invoice: this.toInvoiceResponse(refreshed),
    };
  }

  /** Khách tự hủy yêu cầu thanh toán chưa được xác nhận (bấm nhầm, chuyển sang trả tại quầy...). */
  async cancelPaymentRequest(
    invoiceId: string,
    paymentId: string,
    userId: string,
    userRole: Role,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { include: { booking: { select: { customerId: true } } } } },
    });

    if (!payment || payment.invoiceId !== invoiceId) {
      throw new NotFoundException(`Không tìm thấy yêu cầu thanh toán ID: ${paymentId}`);
    }

    if (
      userRole === Role.CUSTOMER &&
      payment.invoice.booking?.customerId !== userId
    ) {
      throw new ForbiddenException('Bạn chỉ có thể hủy yêu cầu thanh toán của chính mình');
    }

    if (payment.status !== PaymentEntryStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ hủy được yêu cầu đang chờ xác nhận. Yêu cầu đã được lễ tân xử lý thì phải liên hệ quầy lễ tân.',
      );
    }

    await this.prisma.payment.delete({ where: { id: paymentId } });

    const refreshed = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: INVOICE_INCLUDE,
    });

    return {
      message: 'Đã hủy yêu cầu thanh toán',
      invoice: this.toInvoiceResponse(refreshed),
    };
  }

  /** Danh sách yêu cầu thanh toán khách gửi lên, để thu ngân đối chiếu (mặc định PENDING). */
  async findPaymentRequests(queryOrStatus?: QueryPaymentRequestsDto | PaymentEntryStatus) {
    const query: QueryPaymentRequestsDto =
      typeof queryOrStatus === 'string'
        ? { status: queryOrStatus }
        : (queryOrStatus ?? {});

    const status = query.status;
    if (status && !Object.values(PaymentEntryStatus).includes(status)) {
      throw new BadRequestException(
        `Trạng thái "${status}" không hợp lệ. Chỉ nhận: ${Object.values(PaymentEntryStatus).join(', ')}`,
      );
    }

    const where: Prisma.PaymentWhereInput = {
      status: status ?? PaymentEntryStatus.PENDING,
    };

    if (query.search) {
      const search = query.search.trim();
      const insensitive = 'insensitive' as const;
      where.OR = [
        { reference: { contains: search, mode: insensitive } },
        { invoice: { invoiceCode: { contains: search, mode: insensitive } } },
        { invoice: { booking: { customer: { fullName: { contains: search, mode: insensitive } } } } },
        { invoice: { booking: { customer: { phone: { contains: search, mode: insensitive } } } } },
        { invoice: { booking: { room: { roomNumber: { contains: search, mode: insensitive } } } } },
      ];
    }

    const { isPaginated, page, limit, skip, take } = calculatePagination(query);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true, phone: true, role: true } },
          confirmedBy: { select: { id: true, fullName: true } },
          invoice: {
            include: {
              booking: {
                include: {
                  customer: { select: { fullName: true, phone: true } },
                  room: { select: { roomNumber: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take } : {}),
      }),
    ]);

    const data = list.map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      invoiceCode: p.invoice.invoiceCode,
      bookingCode: p.invoice.booking?.bookingCode,
      roomNumber: p.invoice.booking?.room?.roomNumber || 'N/A',
      customerName:
        p.invoice.booking?.customer?.fullName || p.createdBy?.fullName || 'Khách vãng lai',
      customerPhone: p.invoice.booking?.customer?.phone || p.createdBy?.phone || null,
      amount: p.amount,
      paymentMethod: p.method,
      status: p.status,
      reference: p.reference,
      note: p.note,
      requestedAt: p.createdAt,
      confirmedAt: p.confirmedAt,
      confirmedByName: p.confirmedBy?.fullName || null,
      rejectedReason: p.rejectedReason,
      invoiceFinalAmount: roundMoney(p.invoice.finalAmount),
      invoicePaidAmount: roundMoney(p.invoice.paidAmount),
      invoiceRemainingAmount: Math.max(
        0,
        roundMoney(p.invoice.finalAmount) - roundMoney(p.invoice.paidAmount),
      ),
    }));

    return buildPaginatedResult(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
  }

  /** Thu ngân xác nhận đã nhận được tiền -> khoản này mới được cộng vào hóa đơn. */
  async confirmPayment(paymentId: string, dto: ConfirmPaymentDto, cashierId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { id: true, finalAmount: true, paidAmount: true } } },
    });

    if (!payment) {
      throw new NotFoundException(`Không tìm thấy yêu cầu thanh toán ID: ${paymentId}`);
    }

    if (payment.status !== PaymentEntryStatus.PENDING) {
      throw new BadRequestException(
        payment.status === PaymentEntryStatus.CONFIRMED
          ? 'Yêu cầu thanh toán này đã được xác nhận trước đó'
          : 'Yêu cầu thanh toán này đã bị từ chối, không thể xác nhận',
      );
    }

    const amount = dto.amount !== undefined ? roundMoney(dto.amount) : payment.amount;

    if (amount <= 0) {
      throw new BadRequestException('Số tiền xác nhận phải lớn hơn 0');
    }

    const remaining = Math.max(
      0,
      roundMoney(payment.invoice.finalAmount) - roundMoney(payment.invoice.paidAmount),
    );

    if (amount > remaining) {
      throw new BadRequestException(
        `Số tiền xác nhận (${amount.toLocaleString('vi-VN')}đ) vượt quá số còn phải thu của hóa đơn ` +
          `(${remaining.toLocaleString('vi-VN')}đ)`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount,
          method: dto.paymentMethod ?? payment.method,
          status: PaymentEntryStatus.CONFIRMED,
          confirmedById: cashierId,
          confirmedAt: new Date(),
          note: dto.note ? `${payment.note || ''}\n${dto.note}`.trim() : payment.note,
        },
      });

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { issuedById: cashierId },
      });

      return this.recalculateInvoiceTotals(tx, payment.invoiceId);
    });

    const response = this.toInvoiceResponse(updated);

    return {
      message:
        response.remainingAmount > 0
          ? `Đã xác nhận thu ${amount.toLocaleString('vi-VN')}đ. Hóa đơn còn thiếu ${response.remainingAmount.toLocaleString('vi-VN')}đ.`
          : `Đã xác nhận thu ${amount.toLocaleString('vi-VN')}đ. Hóa đơn đã thanh toán đủ.`,
      paymentId,
      amount,
      invoice: response,
    };
  }

  /** Thu ngân từ chối yêu cầu (không thấy giao dịch trên sao kê, sai số tiền...). */
  async rejectPayment(paymentId: string, dto: RejectPaymentDto, cashierId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundException(`Không tìm thấy yêu cầu thanh toán ID: ${paymentId}`);
    }

    if (payment.status !== PaymentEntryStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ từ chối được yêu cầu đang chờ xác nhận. Khoản đã thu muốn trả lại thì dùng chức năng hoàn tiền.',
      );
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentEntryStatus.REJECTED,
        rejectedReason: dto.reason,
        confirmedById: cashierId,
        confirmedAt: new Date(),
      },
    });

    const refreshed = await this.prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
      include: INVOICE_INCLUDE,
    });

    return {
      message: 'Đã từ chối yêu cầu thanh toán',
      paymentId,
      reason: dto.reason,
      invoice: this.toInvoiceResponse(refreshed),
    };
  }

  /**
   * Tạo hóa đơn thủ công (Mục 03 - P1)
   */
  async create(dto: CreateInvoiceDto, cashierId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { serviceOrders: true, invoice: true },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${dto.bookingId}`);
    }

    if (booking.invoice) {
      throw new BadRequestException('Đơn đặt phòng này đã tồn tại hóa đơn');
    }

    const servicesTotal = booking.serviceOrders.reduce(
      (sum, s) => sum + s.totalPrice,
      0,
    );

    const roomAmount = dto.roomAmount !== undefined ? dto.roomAmount : booking.totalAmount;
    const servicesAmount = dto.servicesAmount !== undefined ? dto.servicesAmount : servicesTotal;
    const discount = dto.discount || 0;
    const taxRate = dto.taxRate !== undefined ? dto.taxRate : 0.1;
    const taxable = Math.max(0, roomAmount + servicesAmount - discount);
    const tax = taxable * taxRate;
    const finalAmount = taxable + tax;

    const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const newInvoice = await this.prisma.invoice.create({
      data: {
        invoiceCode,
        bookingId: dto.bookingId,
        roomAmount,
        servicesAmount,
        discount,
        tax,
        finalAmount,
        paidAmount: 0,
        paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
        paymentStatus: PaymentStatus.UNPAID,
        notes: dto.notes,
        issuedById: cashierId,
      },
      include: INVOICE_INCLUDE,
    });

    return this.toInvoiceResponse(newInvoice);
  }

  /**
   * Báo cáo tổng quan doanh thu hôm nay hoặc chốt ca cá nhân (S1 - P1)
   * GET /invoices/summary?date=today&staffId=me
   */
  async getSummary(dateQuery?: string, staffIdQuery?: string, currentUserId?: string) {
    let targetDate = new Date();
    if (dateQuery && dateQuery !== 'today') {
      const parsed = new Date(dateQuery);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    // Nếu có tham số staffId -> chế độ Chốt ca / sổ quỹ cá nhân (S1 - P1)
    if (staffIdQuery) {
      const targetStaffId = staffIdQuery === 'me' ? currentUserId : staffIdQuery;
      let staffName = 'Nhân viên';

      if (targetStaffId) {
        const staffUser = await this.prisma.user.findUnique({
          where: { id: targetStaffId },
          select: { fullName: true },
        });
        if (staffUser) {
          staffName = staffUser.fullName;
        }
      }

      // Tiền thực nhận trong ca lấy thẳng từ sổ thu tiền: mỗi lần thu là một dòng
      // có mốc thời gian riêng, nên khách trả làm nhiều lần / nhiều ngày vẫn được
      // ghi nhận đúng vào ca của người thu.
      const shiftEntries = await this.prisma.payment.findMany({
        where: {
          confirmedById: targetStaffId,
          status: PaymentEntryStatus.CONFIRMED,
          confirmedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { amount: true, method: true, type: true, invoiceId: true },
      });

      let amountCollected = 0;
      const byMethod = {
        CASH: 0,
        CREDIT_CARD: 0,
        BANK_TRANSFER: 0,
      };

      for (const entry of shiftEntries) {
        const signed =
          entry.type === PaymentEntryType.REFUND ? -entry.amount : entry.amount;
        amountCollected += signed;
        byMethod[entry.method] += signed;
      }

      const [invoicesIssued, unpaidLeftBehind, pendingRequests] = await Promise.all([
        this.prisma.invoice.count({
          where: {
            issuedById: targetStaffId,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        // Hóa đơn lập trong ca mà hết ca vẫn chưa thu đủ
        this.prisma.invoice.count({
          where: {
            issuedById: targetStaffId,
            createdAt: { gte: dayStart, lte: dayEnd },
            paymentStatus: {
              in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL],
            },
          },
        }),
        this.prisma.payment.count({ where: { status: PaymentEntryStatus.PENDING } }),
      ]);

      return {
        date: formatLocalDate(dayStart),
        staffId: targetStaffId,
        staffName,
        invoicesIssued,
        amountCollected: roundMoney(amountCollected),
        byMethod: {
          CASH: roundMoney(byMethod.CASH),
          CREDIT_CARD: roundMoney(byMethod.CREDIT_CARD),
          BANK_TRANSFER: roundMoney(byMethod.BANK_TRANSFER),
        },
        unpaidLeftBehind,
        /** Yêu cầu thanh toán của khách còn treo, ca sau phải đối chiếu nốt. */
        pendingPaymentRequests: pendingRequests,
      };
    }

    const [
      revenueTodayAgg,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      partialInvoices,
      pendingPaymentRequests,
      outstandingAgg,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: collectedRevenueWhere(dayStart, dayEnd),
      }),
      this.prisma.invoice.count({
        where: {
          OR: [
            { createdAt: { gte: dayStart, lte: dayEnd } },
            { paidAt: { gte: dayStart, lte: dayEnd } },
          ],
        },
      }),
      this.prisma.invoice.count({
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      this.prisma.invoice.count({
        where: {
          paymentStatus: PaymentStatus.UNPAID,
        },
      }),
      this.prisma.invoice.count({
        where: {
          paymentStatus: PaymentStatus.PARTIAL,
        },
      }),
      this.prisma.payment.count({ where: { status: PaymentEntryStatus.PENDING } }),
      this.prisma.invoice.aggregate({
        _sum: { finalAmount: true, paidAmount: true },
        where: {
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        },
      }),
    ]);

    const todayRevenue = roundMoney(revenueTodayAgg._sum.paidAmount || 0);

    return {
      date: formatLocalDate(dayStart),
      todayRevenue,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      partialInvoices,
      /** Yêu cầu thanh toán khách gửi từ app đang chờ lễ tân đối chiếu. */
      pendingPaymentRequests,
      /** Tổng công nợ khách sạn đang phải thu. */
      outstandingAmount: Math.max(
        0,
        roundMoney(
          (outstandingAgg._sum.finalAmount || 0) - (outstandingAgg._sum.paidAmount || 0),
        ),
      ),
    };
  }

  /**
   * Hoàn tiền hóa đơn (S4 - P1)
   * POST /invoices/:id/refund
   */
  async refund(id: string, dto: RefundDto, staffId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, paidAmount: true, notes: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
    }

    if (invoice.paidAmount <= 0) {
      throw new BadRequestException('Hóa đơn chưa thu tiền hoặc đã hoàn tiền toàn bộ, không thể hoàn thêm');
    }

    if (dto.amount > invoice.paidAmount) {
      throw new BadRequestException(
        `Số tiền hoàn (${dto.amount.toLocaleString()}đ) không được vượt quá số tiền đã thu (${invoice.paidAmount.toLocaleString()}đ)`,
      );
    }

    const refundNote = `[Hoàn tiền: ${dto.amount.toLocaleString()}đ lúc ${new Date().toLocaleString('vi-VN')}. Lý do: ${dto.reason}]`;
    const updatedNotes = invoice.notes ? `${invoice.notes}\n${refundNote}` : refundNote;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Hoàn tiền cũng là một dòng của sổ thu tiền (mang dấu âm) để lịch sử
      // giao dịch hiển thị cho khách luôn đầy đủ.
      await tx.payment.create({
        data: {
          invoiceId: id,
          amount: roundMoney(dto.amount),
          method: dto.paymentMethod ?? PaymentMethod.CASH,
          type: PaymentEntryType.REFUND,
          status: PaymentEntryStatus.CONFIRMED,
          note: `Hoàn tiền. Lý do: ${dto.reason}`,
          createdById: staffId,
          confirmedById: staffId,
          confirmedAt: new Date(),
        },
      });

      await tx.invoice.update({
        where: { id },
        data: { notes: updatedNotes, issuedById: staffId },
      });

      return this.recalculateInvoiceTotals(tx, id);
    });

    return this.toInvoiceResponse(updated);
  }
}
