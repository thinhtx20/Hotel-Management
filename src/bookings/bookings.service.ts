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
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { ApproveBookingDto, RejectBookingDto } from './dto/approve-booking.dto';
import { BookingStatus, PaymentMethod, PaymentStatus, Role, RoomStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Tạo đặt phòng mới được bảo vệ bằng REDIS DISTRIBUTED LOCK
   * Chống Race-Condition tuyệt đối khi nhiều khách cùng đặt 1 phòng
   */
  async create(dto: CreateBookingDto, currentUserId: string, currentUserRole: Role) {
    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);

    if (checkIn >= checkOut) {
      throw new BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
    }

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

      // Kiểm tra xung đột lịch đặt phòng (Overlap check trong DB)
      // Bao gồm cả PENDING (chờ duyệt), CONFIRMED (đã duyệt) và CHECKED_IN (đang ở)
      const conflictBooking = await this.prisma.booking.findFirst({
        where: {
          roomId: dto.roomId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
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
        },
        include: {
          room: { include: { roomType: true } },
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      });

      // Nếu đơn được tạo ở trạng thái CONFIRMED (bởi Lễ tân/Admin), cập nhật phòng sang RESERVED
      if (initialStatus === BookingStatus.CONFIRMED) {
        await this.prisma.room.update({
          where: { id: dto.roomId },
          data: { status: RoomStatus.RESERVED },
        });
      }

      // Xóa cache danh sách phòng trống trong Redis
      await this.redis.delByPattern('cache:rooms:*');

      return this.toBookingResponse(booking);
    } finally {
      // 2. Luôn giải phóng khóa phân tán an toàn bằng Lua script
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  private toBookingResponse(b: any) {
    const checkIn = new Date(b.checkInDate);
    const checkOut = new Date(b.checkOutDate);
    const diff = Math.abs(checkOut.getTime() - checkIn.getTime());
    const nights = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    const paymentStatus = b.invoice?.paymentStatus || (b.depositAmount > 0 ? 'PARTIAL' : 'UNPAID');
    const invoiceId = b.invoice?.id || null;
    const canCancel = b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED;

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
    };
  }

  async findAll(status?: BookingStatus, customerId?: string, roomId?: string) {
    const list = await this.prisma.booking.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {}),
        ...(roomId ? { roomId } : {}),
      },
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        room: { include: { roomType: true } },
        invoice: true,
        serviceOrders: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((b) => this.toBookingResponse(b));
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
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        room: { include: { roomType: true } },
        invoice: true,
        serviceOrders: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
    }

    this.assertOwnership(booking, currentUserId, currentUserRole);

    return this.toBookingResponse(booking);
  }

  /**
   * Phê duyệt đơn đặt phòng khách đặt trước (PENDING -> CONFIRMED)
   * Cập nhật tiền cọc, chuyển phòng sang RESERVED và tạo hóa đơn cọc nếu có tiền cọc
   */
  async approve(id: string, dto?: ApproveBookingDto, currentUserId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        room: { include: { roomType: true } },
        invoice: true,
        serviceOrders: true,
      },
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
        },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          room: { include: { roomType: true } },
          invoice: true,
          serviceOrders: true,
        },
      }),
      this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.RESERVED },
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
    const invoice = results[2] || updatedBooking.invoice;

    await this.redis.delByPattern('cache:rooms:*');

    return {
      message: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
      depositAmount,
      booking: this.toBookingResponse({
        ...updatedBooking,
        invoice,
        room: {
          ...updatedBooking.room,
          status: RoomStatus.RESERVED,
        },
      }),
    };
  }

  /**
   * Từ chối đơn đặt phòng mà khách đặt trước (PENDING -> CANCELLED)
   */
  async reject(id: string, dto?: RejectBookingDto, currentUserId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        room: { include: { roomType: true } },
      },
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

    const [updatedBooking] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          specialRequests: dto?.reason
            ? `${booking.specialRequests || ''}\n[Lý do từ chối: ${dto.reason}]`.trim()
            : booking.specialRequests,
        },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          room: { include: { roomType: true } },
          invoice: true,
          serviceOrders: true,
        },
      }),
      this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.AVAILABLE },
      }),
    ]);

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
        include: { room: true },
      }),
      this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.OCCUPIED },
      }),
    ]);

    await this.redis.delByPattern('cache:rooms:*');
    return updatedBooking;
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

    await this.redis.delByPattern('cache:rooms:*');

    return {
      message: 'Check-out và thanh toán hóa đơn thành công',
      invoiceId: invoice.id,
      booking: updatedBooking,
      invoice,
    };
  }

  async cancel(id: string, currentUserId?: string, currentUserRole?: Role) {
    const booking = await this.findOne(id, currentUserId, currentUserRole);

    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Khách đang ở phòng, không thể hủy đơn đặt');
    }
    if (booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('Đơn đặt phòng đã hoàn tất, không thể hủy');
    }

    const [updatedBooking] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      }),
      this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.AVAILABLE },
      }),
    ]);

    await this.redis.delByPattern('cache:rooms:*');
    return updatedBooking;
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
