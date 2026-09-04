import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { ApproveBookingDto, RejectBookingDto } from './dto/approve-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { deriveRoomStatus } from '../common/utils/room-status.util';
import { BookingStatus, PaymentMethod, PaymentStatus, Prisma, Role, RoomStatus } from '@prisma/client';

/** Include chuẩn dùng chung cho mọi response đơn đặt phòng */
const BOOKING_INCLUDE = {
  customer: { select: { id: true, fullName: true, email: true, phone: true } },
  room: { include: { roomType: true } },
  invoice: true,
  serviceOrders: true,
  confirmedBy: { select: { id: true, fullName: true, role: true } },
  cancelledBy: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.BookingInclude;

/** Đầu ngày / cuối ngày theo giờ máy chủ, để lọc theo ngày bao trọn 24 giờ */
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private esService: ElasticsearchService,
  ) {}

  /**
   * Đẩy trạng thái phòng mới nhất lên Elasticsearch.
   * Bắt buộc sau mọi lần vòng đời đơn làm đổi trạng thái phòng, nếu không
   * `GET /rooms/search?status=...` sẽ vẫn trả về trạng thái cũ đã lưu trong index.
   */
  private async reindexRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (room) {
      await this.esService.indexRoomEntity(room);
    }
  }

  /**
   * Đồng bộ trạng thái phòng theo đúng lịch đặt phòng hiện tại.
   * Gọi sau mọi thao tác làm thay đổi vòng đời đơn (duyệt, hủy, từ chối)
   * để sơ đồ phòng của lễ tân không bao giờ lệch với dữ liệu booking.
   */
  private async syncRoomStatus(roomId: string): Promise<RoomStatus | null> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        bookings: {
          where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
          select: { status: true, checkOutDate: true },
        },
      },
    });

    if (!room) return null;

    const nextStatus = deriveRoomStatus(room.status, room.bookings);
    if (nextStatus === room.status) return room.status;

    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: nextStatus },
    });
    await this.reindexRoom(roomId);

    return nextStatus;
  }

  /**
   * Tạo đặt phòng mới được bảo vệ bằng REDIS DISTRIBUTED LOCK
   * Chống Race-Condition tuyệt đối khi nhiều khách cùng đặt 1 phòng
   */
  async create(dto: CreateBookingDto, currentUserId: string, currentUserRole: Role) {
    const rawCheckIn = new Date(dto.checkInDate);
    const rawCheckOut = new Date(dto.checkOutDate);

    if (rawCheckIn >= rawCheckOut) {
      throw new BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
    }

    // Chuẩn hóa giờ nhận phòng (14:00 UTC) và giờ trả phòng (12:00 UTC) tiêu chuẩn khách sạn
    // Để ngày chuyển tiếp giữa 2 khách (12:00 checkout và 14:00 checkin) không bị xung đột
    const checkIn = new Date(rawCheckIn);
    checkIn.setUTCHours(14, 0, 0, 0);

    const checkOut = new Date(rawCheckOut);
    checkOut.setUTCHours(12, 0, 0, 0);

    // 1. Chiếm khóa phân tán (Distributed Lock) trên phòng này
    const lockKey = `lock:booking:room:${dto.roomId}`;
    const lockToken = await this.redis.acquireLock(lockKey, 6000);

    if (!lockToken) {
      this.logger.warn(`Conflict lock trên phòng ${dto.roomId} bởi request đồng thời`);
      throw new ConflictException(
        'Phòng này đang được khách khác giữ chỗ để thanh toán, vui lòng thử lại sau giây lát!',
      );
    }

    try {
      const room = await this.prisma.room.findUnique({
        where: { id: dto.roomId },
        include: { roomType: true },
      });

      if (!room) {
        throw new NotFoundException(`Không tìm thấy phòng với ID: ${dto.roomId}`);
      }

      if (room.status === RoomStatus.MAINTENANCE) {
        throw new BadRequestException('Phòng này hiện đang bảo trì, không thể đặt');
      }

      const now = new Date();

      // Kiểm tra xung đột lịch đặt phòng (Overlap check trong DB)
      // Bao gồm cả PENDING (chờ duyệt), CONFIRMED (đã duyệt) và CHECKED_IN (đang ở)
      // Bỏ qua các đơn quá hạn trả phòng trong quá khứ
      const conflictBooking = await this.prisma.booking.findFirst({
        where: {
          roomId: dto.roomId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
          checkOutDate: { gt: now },
          AND: [
            { checkInDate: { lt: checkOut } },
            { checkOutDate: { gt: checkIn } },
          ],
        },
      });

      if (conflictBooking) {
        throw new ConflictException(
          'Phòng này đã có khách đặt hoặc đang ở trong khoảng thời gian được chọn',
        );
      }

      // Tính số đêm lưu trú
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
      const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const totalAmount = nights * room.roomType.basePrice;

      // Xác định customerId
      const finalCustomerId =
        currentUserRole === Role.CUSTOMER ? currentUserId : dto.customerId || currentUserId;

      // Trạng thái ban đầu:
      // Khách hàng đặt trước -> PENDING (chờ Lễ tân duyệt & xác nhận cọc)
      // Lễ tân/Admin tạo trực tiếp -> dùng status gửi lên hoặc CONFIRMED
      let initialStatus: BookingStatus = BookingStatus.PENDING;
      if (currentUserRole !== Role.CUSTOMER) {
        initialStatus = dto.status || BookingStatus.CONFIRMED;
      }

      // Sinh mã booking độc nhất
      const bookingCode = `BK-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

      const booking = await this.prisma.booking.create({
        data: {
          bookingCode,
          customerId: finalCustomerId,
          roomId: dto.roomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guestCount: dto.guestCount || 1,
          totalAmount,
          depositAmount: dto.depositAmount || 0,
          status: initialStatus,
          specialRequests: dto.specialRequests,
          ...(initialStatus === BookingStatus.CONFIRMED
            ? { confirmedAt: new Date(), confirmedById: currentUserId }
            : {}),
        },
        include: BOOKING_INCLUDE,
      });

      // Đơn PENDING không chiếm phòng; đơn CONFIRMED (Lễ tân/Admin tạo trực tiếp)
      // đẩy phòng sang RESERVED thông qua bộ suy diễn trạng thái dùng chung.
      await this.syncRoomStatus(dto.roomId);

      // Xóa cache danh sách phòng trống trong Redis
      await this.redis.delByPattern('cache:rooms:*');

      return this.toBookingResponse(booking, currentUserRole);
    } finally {
      // 2. Luôn giải phóng khóa phân tán an toàn bằng Lua script
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * `canCancel` phụ thuộc vào người đang xem đơn:
   * - Khách hàng chỉ được tự hủy khi đơn còn PENDING (chưa qua tay lễ tân).
   * - Lễ tân/Admin (hoặc lời gọi nội bộ, không truyền role) hủy hộ được cả đơn đã CONFIRMED,
   *   nhưng vẫn không hủy được đơn đã nhận phòng / đã trả phòng.
   */
  private toBookingResponse(b: any, viewerRole?: Role) {
    const checkIn = new Date(b.checkInDate);
    const checkOut = new Date(b.checkOutDate);
    const diff = Math.abs(checkOut.getTime() - checkIn.getTime());
    const nights = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    const paymentStatus = b.invoice?.paymentStatus || (b.depositAmount > 0 ? 'PARTIAL' : 'UNPAID');
    const invoiceId = b.invoice?.id || null;
    const canCancel =
      viewerRole === Role.CUSTOMER
        ? b.status === BookingStatus.PENDING
        : b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED;

    let room = b.room;
    if (room) {
      const roomImages = (room.roomType?.images && room.roomType.images.length > 0)
        ? room.roomType.images
        : [
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
          ];
      room = {
        ...room,
        image: roomImages[0] || '',
        imageUrl: roomImages[0] || '',
        images: roomImages,
      };
    }

    return {
      ...b,
      room,
      nights,
      paymentStatus,
      invoiceId,
      canCancel,
      // Luôn có mặt (null nếu đơn chưa bị hủy) để FE không phải kiểm tra undefined
      cancellationReason: b.cancellationReason ?? null,
      cancelledAt: b.cancelledAt ?? null,
      cancelledBy: b.cancelledBy ?? null,
      confirmedAt: b.confirmedAt ?? null,
      confirmedBy: b.confirmedBy ?? null,
      confirmationNote: b.confirmationNote ?? null,
    };
  }

  /**
   * Danh sách đơn đặt phòng với đầy đủ bộ lọc phía máy chủ:
   * trạng thái (nhiều giá trị), khoảng ngày nhận/trả phòng, tìm kiếm và phân trang.
   */
  async findAll(query: QueryBookingsDto = {}, viewerRole?: Role) {
    const where: Prisma.BookingWhereInput = {};

    if (query.status && query.status.length > 0) {
      where.status =
        query.status.length === 1 ? query.status[0] : { in: query.status };
    }
    if (query.customerId) where.customerId = query.customerId;
    if (query.roomId) where.roomId = query.roomId;

    if (query.checkInFrom || query.checkInTo) {
      where.checkInDate = {
        ...(query.checkInFrom ? { gte: startOfDay(new Date(query.checkInFrom)) } : {}),
        ...(query.checkInTo ? { lte: endOfDay(new Date(query.checkInTo)) } : {}),
      };
    }

    if (query.checkOutFrom || query.checkOutTo) {
      where.checkOutDate = {
        ...(query.checkOutFrom ? { gte: startOfDay(new Date(query.checkOutFrom)) } : {}),
        ...(query.checkOutTo ? { lte: endOfDay(new Date(query.checkOutTo)) } : {}),
      };
    }

    const search = query.search?.trim();
    if (search) {
      const insensitive = Prisma.QueryMode.insensitive;
      where.OR = [
        { bookingCode: { contains: search, mode: insensitive } },
        { customer: { fullName: { contains: search, mode: insensitive } } },
        { customer: { phone: { contains: search, mode: insensitive } } },
        { customer: { email: { contains: search, mode: insensitive } } },
        { room: { roomNumber: { contains: search, mode: insensitive } } },
      ];
    }

    // Chỉ phân trang khi client thực sự yêu cầu; không truyền page/limit
    // thì trả về toàn bộ kết quả như hợp đồng API cũ.
    const isPaginated = query.page !== undefined || query.limit !== undefined;
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const [total, list] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        // Giữ nguyên thứ tự cũ (đơn mới nhất lên đầu) để các màn hiện có không đổi cách hiển thị
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
    ]);

    const data = list.map((b) => this.toBookingResponse(b, viewerRole));

    return {
      data,
      meta: {
        total,
        page: isPaginated ? page : 1,
        limit: isPaginated ? limit : total,
        totalPages: isPaginated ? Math.max(1, Math.ceil(total / limit)) : 1,
      },
    };
  }

  /**
   * Khách hàng chỉ được thao tác trên đơn của chính mình.
   * Nhân viên (ADMIN / RECEPTIONIST / CASHIER) và lời gọi nội bộ (không truyền role)
   * đi qua không bị chặn.
   */
  private assertOwnership(booking: any, userId?: string, userRole?: Role) {
    if (userRole === Role.CUSTOMER && booking.customerId !== userId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể xem và thao tác trên đơn đặt phòng của chính mình',
      );
    }
  }

  async findOne(id: string, currentUserId?: string, currentUserRole?: Role) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
    }

    this.assertOwnership(booking, currentUserId, currentUserRole);

    return this.toBookingResponse(booking, currentUserRole);
  }

  /**
   * Phê duyệt đơn đặt phòng khách đặt trước (PENDING -> CONFIRMED)
   * Cập nhật tiền cọc, chuyển phòng sang RESERVED và tạo hóa đơn cọc nếu có tiền cọc
   */
  async approve(
    id: string,
    dto?: ApproveBookingDto & ConfirmBookingDto,
    currentUserId?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new BadRequestException('Đơn đặt phòng này đã được phê duyệt trước đó');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Đơn đặt phòng này đã bị hủy, không thể phê duyệt');
    }

    if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('Đơn đặt phòng đã hoặc đang được thực hiện, không thể duyệt lại');
    }

    // Xếp phòng khi duyệt: mặc định giữ nguyên phòng khách đã chọn.
    const targetRoomId = dto?.assignedRoomId || booking.roomId;

    const targetRoom = await this.prisma.room.findUnique({ where: { id: targetRoomId } });
    if (!targetRoom) {
      throw new NotFoundException(`Không tìm thấy phòng cần xếp với ID: ${targetRoomId}`);
    }
    // Kiểm tra bảo trì cho cả trường hợp giữ nguyên phòng khách đã chọn: nếu bỏ qua,
    // đơn sẽ chuyển CONFIRMED trong khi phòng vẫn nằm ở MAINTENANCE và không giữ chỗ được.
    if (targetRoom.status === RoomStatus.MAINTENANCE) {
      throw new BadRequestException('Phòng được xếp đang bảo trì, không thể nhận khách');
    }

    if (targetRoomId !== booking.roomId) {
      const conflict = await this.prisma.booking.findFirst({
        where: {
          id: { not: id },
          roomId: targetRoomId,
          status: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
          },
          AND: [
            { checkInDate: { lt: booking.checkOutDate } },
            { checkOutDate: { gt: booking.checkInDate } },
          ],
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Phòng ${targetRoom.roomNumber} đã có đơn ${conflict.bookingCode} trùng lịch trong khoảng thời gian này`,
        );
      }
    }

    // Tiền cọc: nếu dto truyền thì cập nhật, không thì giữ nguyên tiền cọc hiện có của booking
    const depositAmount =
      dto?.depositAmount !== undefined ? dto.depositAmount : (booking.depositAmount || 0);

    const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const ops: any[] = [
      this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CONFIRMED,
          depositAmount,
          roomId: targetRoomId,
          confirmedAt: new Date(),
          confirmedById: currentUserId,
          confirmationNote: dto?.note ?? dto?.notes ?? null,
        },
        include: BOOKING_INCLUDE,
      }),
    ];

    if (depositAmount > 0) {
      const isPaid = depositAmount >= booking.totalAmount;
      ops.push(
        this.prisma.invoice.upsert({
          where: { bookingId: id },
          create: {
            invoiceCode,
            bookingId: id,
            roomAmount: booking.totalAmount,
            servicesAmount: 0,
            discount: 0,
            tax: 0,
            finalAmount: booking.totalAmount,
            paidAmount: depositAmount,
            paymentMethod: dto?.paymentMethod || PaymentMethod.BANK_TRANSFER,
            paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
            notes: dto?.notes || 'Tiền cọc giữ chỗ khi duyệt phòng',
            issuedById: currentUserId,
            paidAt: new Date(),
          },
          update: {
            paidAmount: depositAmount,
            paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
            paymentMethod: dto?.paymentMethod || PaymentMethod.BANK_TRANSFER,
            notes: dto?.notes || 'Tiền cọc giữ chỗ khi duyệt phòng',
            issuedById: currentUserId,
            paidAt: new Date(),
          },
        }),
      );
    }

    const results = await this.prisma.$transaction(ops);
    const updatedBooking = results[0];
    const invoice = results[1] || updatedBooking.invoice;

    // Đơn đã xác nhận thì phòng phải đổi trạng thái theo: giữ chỗ RESERVED cho khách sắp tới.
    // Suy ra qua deriveRoomStatus thay vì ép cứng RESERVED, để không ghi đè phòng đang có
    // khách khác lưu trú (OCCUPIED) khi lễ tân xác nhận một đơn cho kỳ nghỉ sau đó.
    const targetRoomStatus = (await this.syncRoomStatus(targetRoomId)) ?? targetRoom.status;

    // Đổi phòng khi duyệt: phòng khách chọn ban đầu phải được trả về đúng trạng thái
    if (targetRoomId !== booking.roomId) {
      await this.syncRoomStatus(booking.roomId);
    }

    await this.redis.delByPattern('cache:rooms:*');

    return {
      message: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
      depositAmount,
      booking: this.toBookingResponse({
        ...updatedBooking,
        invoice,
        room: {
          ...updatedBooking.room,
          status: targetRoomStatus,
        },
      }),
    };
  }

  /**
   * Xác nhận đơn khách tự đặt: PENDING -> CONFIRMED.
   * Alias nghiệp vụ của `approve`, đúng tên gọi màn "Chờ xác nhận" của lễ tân.
   */
  async confirm(id: string, dto?: ConfirmBookingDto, currentUserId?: string) {
    const result = await this.approve(id, dto, currentUserId);
    return {
      ...result,
      message: 'Xác nhận đơn đặt phòng thành công',
    };
  }

  /**
   * Từ chối đơn đặt phòng mà khách đặt trước (PENDING -> CANCELLED)
   */
  async reject(id: string, dto?: RejectBookingDto, currentUserId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Đơn đặt phòng này đã bị hủy trước đó');
    }

    if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('Không thể từ chối đơn đặt phòng đã hoặc đang lưu trú');
    }

    const reason = dto?.cancellationReason || dto?.reason || null;

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledById: currentUserId ?? null,
      },
      include: BOOKING_INCLUDE,
    });

    // Trả phòng về đúng trạng thái theo các đơn còn hiệu lực (không ép cứng AVAILABLE)
    await this.syncRoomStatus(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');

    return {
      message: 'Từ chối đơn đặt phòng thành công',
      booking: this.toBookingResponse(updatedBooking),
    };
  }

  async checkIn(id: string) {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Đơn đặt phòng này đã bị hủy');
    }
    if (booking.status === BookingStatus.PENDING) {
      throw new BadRequestException(
        'Đơn đặt phòng đang ở trạng thái chờ duyệt. Lễ tân vui lòng phê duyệt đơn trước khi thực hiện check-in',
      );
    }
    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Khách đã check-in trước đó');
    }
    if (booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('Đơn đặt phòng này đã hoàn tất check-out');
    }

    const [updatedBooking] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CHECKED_IN,
          actualCheckIn: new Date(),
        },
        include: BOOKING_INCLUDE,
      }),
      this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.OCCUPIED },
      }),
    ]);

    // Khách đã vào phòng: phòng chuyển OCCUPIED trong cùng transaction, chỉ cần
    // làm mới cache và index tìm kiếm để sơ đồ phòng và bộ lọc trạng thái khớp ngay.
    await this.reindexRoom(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');
    return this.toBookingResponse(updatedBooking);
  }

  async checkOut(id: string, dto: CheckOutDto, cashierId: string) {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chỉ có thể check-out đơn đặt phòng đang ở trạng thái CHECKED_IN');
    }

    const servicesTotal = booking.serviceOrders.reduce(
      (sum, s) => sum + s.totalPrice,
      0,
    );

    const roomAmount = booking.totalAmount;
    const discount = dto.discount || 0;
    const taxRate = dto.taxRate !== undefined ? dto.taxRate : 0.1;
    const taxableAmount = Math.max(0, roomAmount + servicesTotal - discount);
    const tax = taxableAmount * taxRate;
    const finalAmount = taxableAmount + tax;

    const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const [updatedBooking, invoice] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CHECKED_OUT,
          actualCheckOut: new Date(),
        },
        include: BOOKING_INCLUDE,
      }),
      this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.CLEANING },
      }),
      this.prisma.invoice.upsert({
        where: { bookingId: id },
        create: {
          invoiceCode,
          bookingId: id,
          roomAmount,
          servicesAmount: servicesTotal,
          discount,
          tax,
          finalAmount,
          paidAmount: finalAmount,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          paymentStatus: PaymentStatus.PAID,
          issuedById: cashierId,
          paidAt: new Date(),
        },
        update: {
          roomAmount,
          servicesAmount: servicesTotal,
          discount,
          tax,
          finalAmount,
          paidAmount: finalAmount,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          paymentStatus: PaymentStatus.PAID,
          issuedById: cashierId,
          paidAt: new Date(),
        },
      }),
    ]);

    // Khách đã trả phòng: phòng sang CLEANING chờ buồng phòng dọn xong
    // (không suy diễn lại từ lịch đặt, tránh nhảy thẳng sang RESERVED khi còn đơn đặt sau đó).
    await this.reindexRoom(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');

    return {
      message: 'Check-out và thanh toán hóa đơn thành công',
      invoiceId: invoice.id,
      booking: this.toBookingResponse({
        ...updatedBooking,
        invoice,
        // Phòng vừa được chuyển sang CLEANING trong cùng transaction
        room: { ...updatedBooking.room, status: RoomStatus.CLEANING },
      }),
      invoice,
    };
  }

  async cancel(
    id: string,
    dto?: CancelBookingDto,
    currentUserId?: string,
    currentUserRole?: Role,
  ) {
    const booking = await this.findOne(id, currentUserId, currentUserRole);

    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Khách đang ở phòng, không thể hủy đơn đặt');
    }
    if (booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('Đơn đặt phòng đã hoàn tất, không thể hủy');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Đơn đặt phòng này đã bị hủy trước đó');
    }

    // Lễ tân đã xác nhận đơn (CONFIRMED) là phòng đã bị giữ chỗ và tiền cọc đã ghi nhận,
    // nên khách không được tự hủy nữa — phải qua lễ tân để xử lý cọc/hoàn tiền.
    // Đơn đã nhận phòng thì mọi vai trò đều bị chặn ở các kiểm tra phía trên.
    if (currentUserRole === Role.CUSTOMER && booking.status !== BookingStatus.PENDING) {
      throw new ForbiddenException(
        'Đơn đặt phòng đã được lễ tân xác nhận nên không thể tự hủy. ' +
          'Vui lòng liên hệ lễ tân để được hỗ trợ.',
      );
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: dto?.cancellationReason || dto?.reason || null,
        cancelledAt: new Date(),
        cancelledById: currentUserId ?? null,
      },
      include: BOOKING_INCLUDE,
    });

    // Trả phòng về đúng trạng thái theo các đơn còn hiệu lực (không ép cứng AVAILABLE)
    await this.syncRoomStatus(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');

    return this.toBookingResponse(updatedBooking, currentUserRole);
  }

  async addServiceOrder(id: string, dto: AddServiceOrderDto) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chỉ có thể thêm dịch vụ cho khách đang lưu trú tại phòng');
    }

    const quantity = dto.quantity || 1;
    const totalPrice = dto.unitPrice * quantity;

    return this.prisma.extraServiceOrder.create({
      data: {
        bookingId: id,
        serviceName: dto.serviceName,
        unitPrice: dto.unitPrice,
        quantity,
        totalPrice,
      },
    });
  }
}
