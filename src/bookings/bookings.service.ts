import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
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
      const conflictBooking = await this.prisma.booking.findFirst({
        where: {
          roomId: dto.roomId,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
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
          status: BookingStatus.CONFIRMED,
          specialRequests: dto.specialRequests,
        },
        include: {
          room: { include: { roomType: true } },
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      });

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

    return {
      ...b,
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

  async findOne(id: string) {
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

    return this.toBookingResponse(booking);
  }

  async checkIn(id: string) {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Đơn đặt phòng này đã bị hủy');
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

  async cancel(id: string) {
    const booking = await this.findOne(id);

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
