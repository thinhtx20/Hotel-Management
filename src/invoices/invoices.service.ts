import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PaymentMethod, PaymentStatus, Role } from '@prisma/client';
import {
  collectedRevenueWhere,
  endOfDay,
  formatLocalDate,
  roundMoney,
  startOfDay,
} from '../common/utils/revenue.util';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper ánh xạ và bổ sung các trường hiển thị theo yêu cầu FE (Mục 04)
   */
  private toInvoiceResponse(invoice: any) {
    const customer = invoice.booking?.customer;
    const room = invoice.booking?.room;
    const serviceOrders = invoice.booking?.serviceOrders || [];

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

    // Danh sách lịch sử thanh toán
    const payments: Array<{
      amount: number;
      paymentMethod: string;
      paidAt: Date | null;
      cashierName: string;
    }> = [];

    if (invoice.paidAmount > 0) {
      payments.push({
        amount: invoice.paidAmount,
        paymentMethod: invoice.paymentMethod,
        paidAt: invoice.paidAt,
        cashierName: invoice.issuedBy?.fullName || 'Thu ngân ca trực',
      });
    }

    return {
      ...invoice,
      roomNumber: room?.roomNumber || 'N/A',
      customerName: customer?.fullName || 'Khách vãng lai',
      customerPhone: customer?.phone || null,
      items,
      payments,
    };
  }

  async findAll(status?: PaymentStatus) {
    const list = await this.prisma.invoice.findMany({
      where: status ? { paymentStatus: status } : undefined,
      include: {
        booking: {
          include: {
            customer: { select: { fullName: true, phone: true, email: true } },
            room: { select: { roomNumber: true } },
            serviceOrders: true,
          },
        },
        issuedBy: { select: { fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((inv) => this.toInvoiceResponse(inv));
  }

  /**
   * Hóa đơn của chính khách hàng đang đăng nhập (màn "Hóa đơn của tôi").
   * Lọc theo chủ đơn đặt phòng, khách không bao giờ thấy hóa đơn của người khác.
   */
  async findMyInvoices(customerId: string, status?: PaymentStatus) {
    const list = await this.prisma.invoice.findMany({
      where: {
        booking: { customerId },
        ...(status ? { paymentStatus: status } : {}),
      },
      include: {
        booking: {
          include: {
            customer: { select: { fullName: true, phone: true, email: true } },
            room: { select: { roomNumber: true } },
            serviceOrders: true,
          },
        },
        issuedBy: { select: { fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((inv) => this.toInvoiceResponse(inv));
  }

  async findOne(id: string, currentUserId?: string, currentUserRole?: Role) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: true,
            room: { include: { roomType: true } },
            serviceOrders: true,
          },
        },
        issuedBy: { select: { fullName: true, email: true, role: true } },
      },
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

  async recordPayment(id: string, dto: RecordPaymentDto, cashierId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: true,
            room: { include: { roomType: true } },
            serviceOrders: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
    }

    const newPaidAmount = invoice.paidAmount + dto.amount;
    const isFullyPaid = newPaidAmount >= invoice.finalAmount;

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        paymentMethod: dto.paymentMethod,
        paymentStatus: isFullyPaid
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL,
        notes: dto.notes ? `${invoice.notes || ''}\n${dto.notes}`.trim() : invoice.notes,
        issuedById: cashierId,
        // Luôn đóng dấu thời điểm thu tiền, kể cả khi mới thu một phần.
        // Trước đây hóa đơn PARTIAL để paidAt = null nên toàn bộ tiền đã thu
        // không xuất hiện ở bất kỳ báo cáo doanh thu theo ngày nào.
        paidAt: new Date(),
      },
      include: {
        booking: {
          include: {
            customer: true,
            room: { include: { roomType: true } },
            serviceOrders: true,
          },
        },
        issuedBy: { select: { fullName: true, email: true, role: true } },
      },
    });

    return this.toInvoiceResponse(updated);
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
      include: {
        booking: {
          include: {
            customer: true,
            room: { include: { roomType: true } },
            serviceOrders: true,
          },
        },
        issuedBy: { select: { fullName: true, email: true, role: true } },
      },
    });

    return this.toInvoiceResponse(newInvoice);
  }

  /**
   * Báo cáo tổng quan doanh thu hôm nay cho thu ngân (Mục 03 - P1)
   * GET /invoices/summary?date=today
   */
  async getSummary(dateQuery?: string) {
    let targetDate = new Date();
    if (dateQuery && dateQuery !== 'today') {
      const parsed = new Date(dateQuery);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const [
      revenueTodayAgg,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      partialInvoices,
    ] = await Promise.all([
      // Dùng chung quy tắc với /analytics để thu ngân và dashboard
      // không còn hiển thị hai con số khác nhau cho cùng một ngày.
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: collectedRevenueWhere(dayStart, dayEnd),
      }),
      this.prisma.invoice.count({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
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
    ]);

    const todayRevenue = roundMoney(revenueTodayAgg._sum.paidAmount || 0);

    return {
      date: formatLocalDate(dayStart),
      todayRevenue,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      partialInvoices,
    };
  }
}
