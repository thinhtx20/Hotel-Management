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
import { ChangeRoomDto } from './dto/change-room.dto';
import { RequestServiceDto } from './dto/request-service.dto';
import { UpdateServiceOrderStatusDto } from './dto/update-service-order-status.dto';
import { roundMoney } from '../common/utils/revenue.util';
import { deriveRoomStatus } from '../common/utils/room-status.util';
import { buildPaginatedResult, calculatePagination } from '../common/utils/pagination.util';
import {
  BookingStatus,
  PaymentEntryStatus,
  PaymentEntryType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  RoomStatus,
  ShiftStatus,
} from '@prisma/client';
import { RoomEventsService } from '../rooms/room-events.service';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Include chuáº©n dÃ¹ng chung cho má»i response Ä‘Æ¡n Ä‘áº·t phÃ²ng */
const BOOKING_INCLUDE = {
  customer: { select: { id: true, fullName: true, email: true, phone: true } },
  room: { include: { roomType: true } },
  invoice: true,
  serviceOrders: true,
  confirmedBy: { select: { id: true, fullName: true, role: true } },
  cancelledBy: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.BookingInclude;

/** Äáº§u ngÃ y / cuá»‘i ngÃ y theo giá» mÃ¡y chá»§, Ä‘á»ƒ lá»c theo ngÃ y bao trá»n 24 giá» */
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
    private roomEvents: RoomEventsService,
    private invoices: InvoicesService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Äáº©y tráº¡ng thÃ¡i phÃ²ng má»›i nháº¥t lÃªn Elasticsearch.
   * Báº¯t buá»™c sau má»i láº§n vÃ²ng Ä‘á»i Ä‘Æ¡n lÃ m Ä‘á»•i tráº¡ng thÃ¡i phÃ²ng, náº¿u khÃ´ng
   * `GET /rooms/search?status=...` sáº½ váº«n tráº£ vá» tráº¡ng thÃ¡i cÅ© Ä‘Ã£ lÆ°u trong index.
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
   * Äá»“ng bá»™ tráº¡ng thÃ¡i phÃ²ng theo Ä‘Ãºng lá»‹ch Ä‘áº·t phÃ²ng hiá»‡n táº¡i.
   * Gá»i sau má»i thao tÃ¡c lÃ m thay Ä‘á»•i vÃ²ng Ä‘á»i Ä‘Æ¡n (duyá»‡t, há»§y, tá»« chá»‘i)
   * Ä‘á»ƒ sÆ¡ Ä‘á»“ phÃ²ng cá»§a lá»… tÃ¢n khÃ´ng bao giá» lá»‡ch vá»›i dá»¯ liá»‡u booking.
   */
  private async syncRoomStatus(roomId: string): Promise<RoomStatus | null> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        bookings: {
          where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
          // checkInDate lÃ  báº¯t buá»™c: thiáº¿u nÃ³, Ä‘Æ¡n CONFIRMED cá»§a ká»³ nghá»‰ sau
          // cÅ©ng bá»‹ coi lÃ  Ä‘ang giá»¯ phÃ²ng hÃ´m nay vÃ  phÃ²ng bá»‹ ghi nháº§m thÃ nh RESERVED.
          select: { status: true, checkInDate: true, checkOutDate: true },
        },
      },
    });

    if (!room) return null;

    const nextStatus = deriveRoomStatus(room.status, room.bookings);
    if (nextStatus === room.status) return room.status;

    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: { status: nextStatus },
      include: { roomType: true },
    });
    await this.reindexRoom(roomId);
    await this.redis.delByPattern('cache:rooms:*');

    this.roomEvents.emitStatusChanged({
      id: updated.id,
      roomNumber: updated.roomNumber,
      floor: updated.floor,
      status: updated.status,
      previousStatus: room.status,
      roomTypeId: updated.roomTypeId,
      roomTypeName: updated.roomType?.name,
      roomTypeCode: updated.roomType?.code,
      pricePerNight: updated.roomType?.basePrice,
      notes: updated.notes,
      updatedAt: updated.updatedAt,
    });

    return nextStatus;
  }

  /**
   * Táº¡o Ä‘áº·t phÃ²ng má»›i Ä‘Æ°á»£c báº£o vá»‡ báº±ng REDIS DISTRIBUTED LOCK
   * Chá»‘ng Race-Condition tuyá»‡t Ä‘á»‘i khi nhiá»u khÃ¡ch cÃ¹ng Ä‘áº·t 1 phÃ²ng
   */
  async create(dto: CreateBookingDto, currentUserId: string, currentUserRole: Role) {
    const rawCheckIn = new Date(dto.checkInDate);
    const rawCheckOut = new Date(dto.checkOutDate);

    if (rawCheckIn >= rawCheckOut) {
      throw new BadRequestException('NgÃ y nháº­n phÃ²ng pháº£i trÆ°á»›c ngÃ y tráº£ phÃ²ng');
    }

    // Chuáº©n hÃ³a giá» nháº­n phÃ²ng (14:00 UTC) vÃ  giá» tráº£ phÃ²ng (12:00 UTC) tiÃªu chuáº©n khÃ¡ch sáº¡n
    // Äá»ƒ ngÃ y chuyá»ƒn tiáº¿p giá»¯a 2 khÃ¡ch (12:00 checkout vÃ  14:00 checkin) khÃ´ng bá»‹ xung Ä‘á»™t
    const checkIn = new Date(rawCheckIn);
    checkIn.setUTCHours(14, 0, 0, 0);

    const checkOut = new Date(rawCheckOut);
    checkOut.setUTCHours(12, 0, 0, 0);

    // 1. Chiáº¿m khÃ³a phÃ¢n tÃ¡n (Distributed Lock) trÃªn phÃ²ng nÃ y
    const lockKey = `lock:booking:room:${dto.roomId}`;
    const lockToken = await this.redis.acquireLock(lockKey, 6000);

    if (!lockToken) {
      this.logger.warn(`Conflict lock trÃªn phÃ²ng ${dto.roomId} bá»Ÿi request Ä‘á»“ng thá»i`);
      throw new ConflictException(
        'PhÃ²ng nÃ y Ä‘ang Ä‘Æ°á»£c khÃ¡ch khÃ¡c giá»¯ chá»— Ä‘á»ƒ thanh toÃ¡n, vui lÃ²ng thá»­ láº¡i sau giÃ¢y lÃ¡t!',
      );
    }

    try {
      const room = await this.prisma.room.findUnique({
        where: { id: dto.roomId },
        include: { roomType: true },
      });

      if (!room) {
        throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y phÃ²ng vá»›i ID: ${dto.roomId}`);
      }

      if (room.status === RoomStatus.MAINTENANCE) {
        throw new BadRequestException('PhÃ²ng nÃ y hiá»‡n Ä‘ang báº£o trÃ¬, khÃ´ng thá»ƒ Ä‘áº·t');
      }

      const now = new Date();

      // Kiá»ƒm tra xung Ä‘á»™t lá»‹ch Ä‘áº·t phÃ²ng (Overlap check trong DB)
      // Bao gá»“m cáº£ PENDING (chá» duyá»‡t), CONFIRMED (Ä‘Ã£ duyá»‡t) vÃ  CHECKED_IN (Ä‘ang á»Ÿ)
      // Bá» qua cÃ¡c Ä‘Æ¡n quÃ¡ háº¡n tráº£ phÃ²ng trong quÃ¡ khá»©
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
          'PhÃ²ng nÃ y Ä‘Ã£ cÃ³ khÃ¡ch Ä‘áº·t hoáº·c Ä‘ang á»Ÿ trong khoáº£ng thá»i gian Ä‘Æ°á»£c chá»n',
        );
      }

      // TÃ­nh sá»‘ Ä‘Ãªm lÆ°u trÃº
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
      const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const totalAmount = nights * room.roomType.basePrice;

      // XÃ¡c Ä‘á»‹nh customerId
      const finalCustomerId =
        currentUserRole === Role.CUSTOMER ? currentUserId : dto.customerId || currentUserId;

      // Tráº¡ng thÃ¡i ban Ä‘áº§u:
      // KhÃ¡ch hÃ ng Ä‘áº·t trÆ°á»›c -> PENDING (chá» Lá»… tÃ¢n duyá»‡t & xÃ¡c nháº­n cá»c)
      // Lá»… tÃ¢n/Admin táº¡o trá»±c tiáº¿p -> dÃ¹ng status gá»­i lÃªn hoáº·c CONFIRMED
      let initialStatus: BookingStatus = BookingStatus.PENDING;
      if (currentUserRole !== Role.CUSTOMER) {
        initialStatus = dto.status || BookingStatus.CONFIRMED;
      }

      // Sinh mÃ£ booking Ä‘á»™c nháº¥t
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

      // ÄÆ¡n PENDING khÃ´ng chiáº¿m phÃ²ng; Ä‘Æ¡n CONFIRMED (Lá»… tÃ¢n/Admin táº¡o trá»±c tiáº¿p)
      // Ä‘áº©y phÃ²ng sang RESERVED thÃ´ng qua bá»™ suy diá»…n tráº¡ng thÃ¡i dÃ¹ng chung.
      await this.syncRoomStatus(dto.roomId);

      // XÃ³a cache danh sÃ¡ch phÃ²ng trá»‘ng trong Redis
      await this.redis.delByPattern('cache:rooms:*');

      this.notificationsService.sendToUser(finalCustomerId, {
        title: initialStatus === BookingStatus.CONFIRMED ? 'Xác nhận đặt phòng' : 'Đơn đặt phòng mới',
        body: `Đơn đặt phòng ${booking.bookingCode} (${room?.roomNumber ? 'Phòng ' + room.roomNumber : ''}) đã được tạo thành công.`,
        category: 'booking',
        actionRoute: '/my-bookings',
        actionLabel: 'Xem chuyến đi',
        data: {
          type: 'BOOKING_CREATED',
          bookingId: booking.id,
        },
      }).catch(() => {});

      return this.toBookingResponse(booking, currentUserRole);
    } finally {
      // 2. LuÃ´n giáº£i phÃ³ng khÃ³a phÃ¢n tÃ¡n an toÃ n báº±ng Lua script
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * `canCancel` phá»¥ thuá»™c vÃ o ngÆ°á»i Ä‘ang xem Ä‘Æ¡n:
   * - KhÃ¡ch hÃ ng chá»‰ Ä‘Æ°á»£c tá»± há»§y khi Ä‘Æ¡n cÃ²n PENDING (chÆ°a qua tay lá»… tÃ¢n).
   * - Lá»… tÃ¢n/Admin (hoáº·c lá»i gá»i ná»™i bá»™, khÃ´ng truyá»n role) há»§y há»™ Ä‘Æ°á»£c cáº£ Ä‘Æ¡n Ä‘Ã£ CONFIRMED,
   *   nhÆ°ng váº«n khÃ´ng há»§y Ä‘Æ°á»£c Ä‘Æ¡n Ä‘Ã£ nháº­n phÃ²ng / Ä‘Ã£ tráº£ phÃ²ng.
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
      // LuÃ´n cÃ³ máº·t (null náº¿u Ä‘Æ¡n chÆ°a bá»‹ há»§y) Ä‘á»ƒ FE khÃ´ng pháº£i kiá»ƒm tra undefined
      cancellationReason: b.cancellationReason ?? null,
      cancelledAt: b.cancelledAt ?? null,
      cancelledBy: b.cancelledBy ?? null,
      confirmedAt: b.confirmedAt ?? null,
      confirmedBy: b.confirmedBy ?? null,
      confirmationNote: b.confirmationNote ?? null,
    };
  }

  /**
   * Danh sÃ¡ch Ä‘Æ¡n Ä‘áº·t phÃ²ng vá»›i Ä‘áº§y Ä‘á»§ bá»™ lá»c phÃ­a mÃ¡y chá»§:
   * tráº¡ng thÃ¡i (nhiá»u giÃ¡ trá»‹), khoáº£ng ngÃ y nháº­n/tráº£ phÃ²ng, tÃ¬m kiáº¿m vÃ  phÃ¢n trang.
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

    const { isPaginated, page, limit, skip, take } = calculatePagination(query);

    const [total, list] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        // Giá»¯ nguyÃªn thá»© tá»± cÅ© (Ä‘Æ¡n má»›i nháº¥t lÃªn Ä‘áº§u) Ä‘á»ƒ cÃ¡c mÃ n hiá»‡n cÃ³ khÃ´ng Ä‘á»•i cÃ¡ch hiá»ƒn thá»‹
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take } : {}),
      }),
    ]);

    const data = list.map((b) => this.toBookingResponse(b, viewerRole));
    return buildPaginatedResult(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
  }

  /**
   * KhÃ¡ch hÃ ng chá»‰ Ä‘Æ°á»£c thao tÃ¡c trÃªn Ä‘Æ¡n cá»§a chÃ­nh mÃ¬nh.
   * NhÃ¢n viÃªn (ADMIN / RECEPTIONIST) vÃ  lá»i gá»i ná»™i bá»™ (khÃ´ng truyá»n role)
   * Ä‘i qua khÃ´ng bá»‹ cháº·n.
   */
  private assertOwnership(booking: any, userId?: string, userRole?: Role) {
    if (userRole === Role.CUSTOMER && booking.customerId !== userId) {
      throw new ForbiddenException(
        'Báº¡n chá»‰ cÃ³ thá»ƒ xem vÃ  thao tÃ¡c trÃªn Ä‘Æ¡n Ä‘áº·t phÃ²ng cá»§a chÃ­nh mÃ¬nh',
      );
    }
  }

  async findOne(id: string, currentUserId?: string, currentUserRole?: Role) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n Ä‘áº·t phÃ²ng ID: ${id}`);
    }

    this.assertOwnership(booking, currentUserId, currentUserRole);

    return this.toBookingResponse(booking, currentUserRole);
  }

  /**
   * PhÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng khÃ¡ch Ä‘áº·t trÆ°á»›c (PENDING -> CONFIRMED)
   * Cáº­p nháº­t tiá»n cá»c, chuyá»ƒn phÃ²ng sang RESERVED vÃ  táº¡o hÃ³a Ä‘Æ¡n cá»c náº¿u cÃ³ tiá»n cá»c
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
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n Ä‘áº·t phÃ²ng ID: ${id}`);
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t trÆ°á»›c Ä‘Ã³');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y, khÃ´ng thá»ƒ phÃª duyá»‡t');
    }

    if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ hoáº·c Ä‘ang Ä‘Æ°á»£c thá»±c hiá»‡n, khÃ´ng thá»ƒ duyá»‡t láº¡i');
    }

    // Xáº¿p phÃ²ng khi duyá»‡t: máº·c Ä‘á»‹nh giá»¯ nguyÃªn phÃ²ng khÃ¡ch Ä‘Ã£ chá»n.
    const targetRoomId = dto?.assignedRoomId || booking.roomId;

    const targetRoom = await this.prisma.room.findUnique({ where: { id: targetRoomId } });
    if (!targetRoom) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y phÃ²ng cáº§n xáº¿p vá»›i ID: ${targetRoomId}`);
    }
    // Kiá»ƒm tra báº£o trÃ¬ cho cáº£ trÆ°á»ng há»£p giá»¯ nguyÃªn phÃ²ng khÃ¡ch Ä‘Ã£ chá»n: náº¿u bá» qua,
    // Ä‘Æ¡n sáº½ chuyá»ƒn CONFIRMED trong khi phÃ²ng váº«n náº±m á»Ÿ MAINTENANCE vÃ  khÃ´ng giá»¯ chá»— Ä‘Æ°á»£c.
    if (targetRoom.status === RoomStatus.MAINTENANCE) {
      throw new BadRequestException('PhÃ²ng Ä‘Æ°á»£c xáº¿p Ä‘ang báº£o trÃ¬, khÃ´ng thá»ƒ nháº­n khÃ¡ch');
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
          `PhÃ²ng ${targetRoom.roomNumber} Ä‘Ã£ cÃ³ Ä‘Æ¡n ${conflict.bookingCode} trÃ¹ng lá»‹ch trong khoáº£ng thá»i gian nÃ y`,
        );
      }
    }

    // Tiá»n cá»c: náº¿u dto truyá»n thÃ¬ cáº­p nháº­t, khÃ´ng thÃ¬ giá»¯ nguyÃªn tiá»n cá»c hiá»‡n cÃ³ cá»§a booking
    const depositAmount =
      dto?.depositAmount !== undefined ? dto.depositAmount : (booking.depositAmount || 0);

    const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const { updatedBooking, invoice } = await this.prisma.$transaction(async (tx) => {
      const bookingRow = await tx.booking.update({
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
      });

      if (depositAmount <= 0) {
        return { updatedBooking: bookingRow, invoice: bookingRow.invoice };
      }

      const invoiceRow = await tx.invoice.upsert({
        where: { bookingId: id },
        create: {
          invoiceCode,
          bookingId: id,
          roomAmount: booking.totalAmount,
          servicesAmount: 0,
          discount: 0,
          tax: 0,
          finalAmount: booking.totalAmount,
          paidAmount: 0,
          paymentMethod: dto?.paymentMethod || PaymentMethod.BANK_TRANSFER,
          paymentStatus: PaymentStatus.UNPAID,
          notes: dto?.notes || 'Tiá»n cá»c giá»¯ chá»— khi duyá»‡t phÃ²ng',
          issuedById: currentUserId,
        },
        update: {
          paymentMethod: dto?.paymentMethod || PaymentMethod.BANK_TRANSFER,
          notes: dto?.notes || 'Tiá»n cá»c giá»¯ chá»— khi duyá»‡t phÃ²ng',
          issuedById: currentUserId,
        },
      });

      // Tiá»n cá»c pháº£i náº±m trÃªn sá»• thu tiá»n, náº¿u khÃ´ng nÃ³ sáº½ biáº¿n máº¥t á»Ÿ láº§n
      // tÃ­nh láº¡i hÃ³a Ä‘Æ¡n káº¿ tiáº¿p (paidAmount luÃ´n Ä‘Æ°á»£c dá»±ng láº¡i tá»« sá»• nÃ y).
      // deleteMany lÃ  chá»‘t an toÃ n: Ä‘Æ¡n CONFIRMED khÃ´ng duyá»‡t láº¡i Ä‘Æ°á»£c nÃªn bÃ¬nh
      // thÆ°á»ng khÃ´ng cÃ³ dÃ²ng cá»c cÅ©, nhÆ°ng náº¿u cÃ³ thÃ¬ pháº£i thay chá»© khÃ´ng cá»™ng dá»“n.
      await tx.payment.deleteMany({
        where: { invoiceId: invoiceRow.id, type: PaymentEntryType.DEPOSIT },
      });

      const activeShift = currentUserId
        ? await tx.workShift.findFirst({
            where: { staffId: currentUserId, status: ShiftStatus.OPEN },
            select: { id: true },
          })
        : null;

      await tx.payment.create({
        data: {
          invoiceId: invoiceRow.id,
          amount: roundMoney(depositAmount),
          method: dto?.paymentMethod || PaymentMethod.BANK_TRANSFER,
          type: PaymentEntryType.DEPOSIT,
          status: PaymentEntryStatus.CONFIRMED,
          note: 'Tiá»n cá»c giá»¯ chá»— khi duyá»‡t phÃ²ng',
          createdById: currentUserId,
          confirmedById: currentUserId,
          confirmedAt: new Date(),
          shiftId: activeShift?.id || null,
        },
      });

      const settledInvoice = await this.invoices.recalculateInvoiceTotals(
        tx,
        invoiceRow.id,
      );

      return { updatedBooking: bookingRow, invoice: settledInvoice };
    });

    // ÄÆ¡n Ä‘Ã£ xÃ¡c nháº­n thÃ¬ phÃ²ng pháº£i Ä‘á»•i tráº¡ng thÃ¡i theo: giá»¯ chá»— RESERVED cho khÃ¡ch sáº¯p tá»›i.
    // Suy ra qua deriveRoomStatus thay vÃ¬ Ã©p cá»©ng RESERVED, Ä‘á»ƒ khÃ´ng ghi Ä‘Ã¨ phÃ²ng Ä‘ang cÃ³
    // khÃ¡ch khÃ¡c lÆ°u trÃº (OCCUPIED) khi lá»… tÃ¢n xÃ¡c nháº­n má»™t Ä‘Æ¡n cho ká»³ nghá»‰ sau Ä‘Ã³.
    const targetRoomStatus = (await this.syncRoomStatus(targetRoomId)) ?? targetRoom.status;

    // Äá»•i phÃ²ng khi duyá»‡t: phÃ²ng khÃ¡ch chá»n ban Ä‘áº§u pháº£i Ä‘Æ°á»£c tráº£ vá» Ä‘Ãºng tráº¡ng thÃ¡i
    if (targetRoomId !== booking.roomId) {
      await this.syncRoomStatus(booking.roomId);
    }

    await this.redis.delByPattern('cache:rooms:*');

    this.notificationsService.sendToUser(booking.customerId, {
      title: 'Đơn đặt phòng đã được duyệt',
      body: `Đơn đặt phòng ${booking.bookingCode} của Quý khách đã được xác nhận.`,
      category: 'booking',
      actionRoute: '/my-bookings',
      actionLabel: 'Xem chuyến đi',
      data: {
        type: 'BOOKING_CONFIRMED',
        bookingId: booking.id,
      },
    }).catch(() => {});

    return {
      message: 'PhÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng vÃ  xÃ¡c nháº­n tiá»n cá»c thÃ nh cÃ´ng',
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
   * XÃ¡c nháº­n Ä‘Æ¡n khÃ¡ch tá»± Ä‘áº·t: PENDING -> CONFIRMED.
   * Alias nghiá»‡p vá»¥ cá»§a `approve`, Ä‘Ãºng tÃªn gá»i mÃ n "Chá» xÃ¡c nháº­n" cá»§a lá»… tÃ¢n.
   */
  async confirm(id: string, dto?: ConfirmBookingDto, currentUserId?: string) {
    const result = await this.approve(id, dto, currentUserId);
    return {
      ...result,
      message: 'XÃ¡c nháº­n Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    };
  }

  /**
   * Tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng mÃ  khÃ¡ch Ä‘áº·t trÆ°á»›c (PENDING -> CANCELLED)
   */
  async reject(id: string, dto?: RejectBookingDto, currentUserId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n Ä‘áº·t phÃ²ng ID: ${id}`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y trÆ°á»›c Ä‘Ã³');
    }

    if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('KhÃ´ng thá»ƒ tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ hoáº·c Ä‘ang lÆ°u trÃº');
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

    // Tráº£ phÃ²ng vá» Ä‘Ãºng tráº¡ng thÃ¡i theo cÃ¡c Ä‘Æ¡n cÃ²n hiá»‡u lá»±c (khÃ´ng Ã©p cá»©ng AVAILABLE)
    await this.syncRoomStatus(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');

    this.notificationsService.sendToUser(booking.customerId, {
      title: 'Đơn đặt phòng đã hủy',
      body: `Đơn đặt phòng ${booking.bookingCode} đã bị từ chối/hủy.${reason ? ' Lý do: ' + reason : ''}`,
      category: 'booking',
      actionRoute: '/my-bookings',
      actionLabel: 'Chi tiết đơn',
      data: {
        type: 'BOOKING_CANCELLED',
        bookingId: booking.id,
      },
    }).catch(() => {});

    return {
      message: 'Tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
      booking: this.toBookingResponse(updatedBooking),
    };
  }

  async checkIn(id: string) {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y');
    }
    if (booking.status === BookingStatus.PENDING) {
      throw new BadRequestException(
        'ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘ang á»Ÿ tráº¡ng thÃ¡i chá» duyá»‡t. Lá»… tÃ¢n vui lÃ²ng phÃª duyá»‡t Ä‘Æ¡n trÆ°á»›c khi thá»±c hiá»‡n check-in',
      );
    }
    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new BadRequestException('KhÃ¡ch Ä‘Ã£ check-in trÆ°á»›c Ä‘Ã³');
    }
    if (booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ hoÃ n táº¥t check-out');
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

    // KhÃ¡ch Ä‘Ã£ vÃ o phÃ²ng: phÃ²ng chuyá»ƒn OCCUPIED trong cÃ¹ng transaction, chá»‰ cáº§n
    // lÃ m má»›i cache vÃ  index tÃ¬m kiáº¿m Ä‘á»ƒ sÆ¡ Ä‘á»“ phÃ²ng vÃ  bá»™ lá»c tráº¡ng thÃ¡i khá»›p ngay.
    await this.reindexRoom(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');

    if (updatedBooking.room) {
      this.roomEvents.emitStatusChanged({
        id: updatedBooking.room.id,
        roomNumber: updatedBooking.room.roomNumber,
        floor: updatedBooking.room.floor,
        status: RoomStatus.OCCUPIED,
        previousStatus: booking.room?.status,
        roomTypeId: updatedBooking.room.roomTypeId,
        roomTypeName: updatedBooking.room.roomType?.name,
        roomTypeCode: updatedBooking.room.roomType?.code,
        pricePerNight: updatedBooking.room.roomType?.basePrice,
        notes: updatedBooking.room.notes,
        updatedAt: new Date().toISOString(),
      });
    }

    this.notificationsService.sendToUser(booking.customerId, {
      title: 'Nhận phòng thành công',
      body: `Chào mừng Quý khách đến với phòng ${updatedBooking.room?.roomNumber ?? ''}! Chúc Quý khách một kỳ nghỉ tuyệt vời.`,
      category: 'booking',
      actionRoute: '/my-bookings',
      actionLabel: 'Xem chuyến đi',
      data: {
        type: 'CHECK_IN_SUCCESS',
        bookingId: booking.id,
      },
    }).catch(() => {});

    return this.toBookingResponse(updatedBooking);
  }

  /**
   * TÃ­nh báº£ng quyáº¿t toÃ¡n cá»§a má»™t Ä‘Æ¡n Ä‘ang lÆ°u trÃº.
   *
   * DÃ¹ng chung cho `checkoutPreview` (thu ngÃ¢n xem trÆ°á»›c) vÃ  `checkOut` (chá»‘t tháº­t)
   * Ä‘á»ƒ hai con sá»‘ khÃ´ng bao giá» lá»‡ch nhau.
   */
  private buildSettlement(booking: any, dto?: CheckOutDto) {
    const confirmedServices = booking.serviceOrders.filter(
      (s: any) => s.status === 'CONFIRMED' || !s.status,
    );
    const servicesTotal = roundMoney(
      confirmedServices.reduce((sum: number, s: any) => sum + s.totalPrice, 0),
    );

    // TÃ­nh toÃ¡n sá»‘ Ä‘Ãªm Ä‘áº·t ban Ä‘áº§u vs sá»‘ Ä‘Ãªm thá»±c táº¿ (Ä‘á»ƒ phÃ¡t hiá»‡n tráº£ phÃ²ng trÆ°á»›c háº¡n)
    const checkIn = new Date(booking.actualCheckIn || booking.checkInDate);
    const scheduledCheckOut = new Date(booking.checkOutDate);
    const now = new Date();

    const bookedDiffTime = Math.abs(scheduledCheckOut.getTime() - checkIn.getTime());
    const bookedNights = Math.max(1, Math.ceil(bookedDiffTime / (1000 * 60 * 60 * 24)));

    // Sá»‘ Ä‘Ãªm á»Ÿ thá»±c táº¿ tÃ­nh tá»« lÃºc nháº­n phÃ²ng Ä‘áº¿n hiá»‡n táº¡i (tá»‘i thiá»ƒu 1 Ä‘Ãªm)
    const actualDiffTime = Math.abs(now.getTime() - checkIn.getTime());
    const actualNights = Math.max(1, Math.ceil(actualDiffTime / (1000 * 60 * 60 * 24)));

    // Nháº­n diá»‡n Ä‘Æ¡n tráº£ phÃ²ng trÆ°á»›c háº¡n (thá»i Ä‘iá»ƒm hiá»‡n táº¡i sá»›m hÆ¡n ngÃ y tráº£ dá»± kiáº¿n vÃ  sá»‘ Ä‘Ãªm thá»±c táº¿ Ã­t hÆ¡n)
    const isEarlyCheckOut = now < scheduledCheckOut && actualNights < bookedNights;

    // ÄÆ¡n giÃ¡ 1 Ä‘Ãªm cÆ¡ sá»Ÿ
    const basePrice =
      booking.room?.roomType?.basePrice ||
      (bookedNights > 0 ? roundMoney(booking.totalAmount / bookedNights) : booking.totalAmount);

    const originalRoomAmount = roundMoney(booking.totalAmount);
    const recalculatedRoomAmount = roundMoney(actualNights * basePrice);

    // XÃ¡c Ä‘á»‹nh tiá»n phÃ²ng Ã¡p dá»¥ng:
    // 1. Náº¿u cÃ³ customRoomAmount Ä‘Æ°á»£c truyá»n lÃªn: dÃ¹ng customRoomAmount
    // 2. Náº¿u tráº£ phÃ²ng trÆ°á»›c háº¡n:
    //    - Náº¿u dto?.recalculateRoomAmount === false: giá»¯ nguyÃªn originalRoomAmount
    //    - Máº·c Ä‘á»‹nh (hoáº·c dto?.recalculateRoomAmount === true): dÃ¹ng recalculatedRoomAmount
    // 3. Tráº£ phÃ²ng Ä‘Ãºng háº¡n / quÃ¡ háº¡n: dÃ¹ng originalRoomAmount
    let roomAmount = originalRoomAmount;
    if (dto?.customRoomAmount !== undefined && dto.customRoomAmount >= 0) {
      roomAmount = roundMoney(dto.customRoomAmount);
    } else if (isEarlyCheckOut) {
      if (dto?.recalculateRoomAmount === false) {
        roomAmount = originalRoomAmount;
      } else {
        roomAmount = recalculatedRoomAmount;
      }
    }

    const discount = roundMoney(dto?.discount ?? booking.invoice?.discount ?? 0);
    const taxRate = dto?.taxRate !== undefined ? dto.taxRate : 0.1;
    const taxableAmount = Math.max(0, roomAmount + servicesTotal - discount);
    const tax = roundMoney(taxableAmount * taxRate);
    const finalAmount = roundMoney(taxableAmount + tax);

    // Tiá»n Ä‘Ã£ thá»±c sá»± vÃ o kÃ©t: tiá»n cá»c lÃºc duyá»‡t Ä‘Æ¡n + cÃ¡c láº§n khÃ¡ch Ä‘Ã£ tráº£.
    // Táº¥t cáº£ Ä‘á»u Ä‘Ã£ Ä‘Æ°á»£c cá»™ng dá»“n sáºµn trong invoice.paidAmount.
    const alreadyPaid = roundMoney(booking.invoice?.paidAmount ?? 0);

    // Náº¿u khÃ¡ch Ä‘Ã£ tráº£ nhiá»u hÆ¡n finalAmount (thÆ°á»ng gáº·p khi khÃ¡ch cá»c/tráº£ trÆ°á»›c toÃ n bá»™ nhÆ°ng tráº£ phÃ²ng sá»›m):
    // amountDue = 0, refundDue = alreadyPaid - finalAmount
    const amountDue = Math.max(0, finalAmount - alreadyPaid);
    const refundDue = Math.max(0, alreadyPaid - finalAmount);

    return {
      roomAmount,
      servicesAmount: servicesTotal,
      discount,
      taxRate,
      tax,
      finalAmount,
      depositAmount: roundMoney(booking.depositAmount || 0),
      alreadyPaidAmount: alreadyPaid,
      /** Sá»‘ tiá»n thu ngÃ¢n cáº§n thu cá»§a khÃ¡ch lÃºc tráº£ phÃ²ng. */
      amountDue,
      /** Sá»‘ tiá»n khÃ¡ch sáº¡n cáº§n hoÃ n tráº£ cho khÃ¡ch náº¿u Ä‘Ã£ thu dÆ° lÃºc tráº£ phÃ²ng trÆ°á»›c háº¡n. */
      refundDue,
      isEarlyCheckOut,
      bookedNights,
      actualNights,
      basePrice,
      originalRoomAmount,
      recalculatedRoomAmount,
      serviceItems: confirmedServices.map((s: any) => ({
        id: s.id,
        name: s.serviceName,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.totalPrice,
      })),
    };
  }

  /**
   * Báº£ng quyáº¿t toÃ¡n trÆ°á»›c khi tráº£ phÃ²ng (thu ngÃ¢n báº¥m "Check-out" lÃ  tháº¥y ngay
   * pháº£i thu bao nhiÃªu). Chá»‰ Ä‘á»c â€” khÃ´ng Ä‘á»•i tráº¡ng thÃ¡i Ä‘Æ¡n hay phÃ²ng.
   */
  async checkoutPreview(id: string) {
    const booking = await this.findOne(id);

    if (
      booking.status !== BookingStatus.CHECKED_IN &&
      booking.status !== BookingStatus.CHECKED_OUT
    ) {
      throw new BadRequestException(
        'Chá»‰ xem Ä‘Æ°á»£c báº£ng quyáº¿t toÃ¡n cá»§a Ä‘Æ¡n Ä‘ang lÆ°u trÃº (CHECKED_IN) hoáº·c Ä‘Ã£ tráº£ phÃ²ng (CHECKED_OUT)',
      );
    }

    const settlement = this.buildSettlement(booking);
    const pendingRequests = booking.invoice
      ? await this.prisma.payment.findMany({
          where: { invoiceId: booking.invoice.id, status: PaymentEntryStatus.PENDING },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      roomNumber: booking.room?.roomNumber,
      customerName: booking.customer?.fullName,
      customerPhone: booking.customer?.phone,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      actualCheckIn: booking.actualCheckIn,
      invoiceId: booking.invoice?.id ?? null,
      invoiceCode: booking.invoice?.invoiceCode ?? null,
      ...settlement,
      /**
       * YÃªu cáº§u khÃ¡ch Ä‘Ã£ gá»­i qua app nhÆ°ng chÆ°a Ä‘á»‘i chiáº¿u xong. Thu ngÃ¢n nÃªn xá»­ lÃ½
       * háº¿t danh sÃ¡ch nÃ y trÆ°á»›c khi thu tiá»n máº·t Ä‘á»ƒ trÃ¡nh thu trÃ¹ng.
       */
      pendingPaymentRequests: pendingRequests.map((p) => ({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.method,
        reference: p.reference,
        note: p.note,
        requestedAt: p.createdAt,
      })),
      pendingPaymentAmount: roundMoney(
        pendingRequests.reduce((sum, p) => sum + p.amount, 0),
      ),
    };
  }

  async checkOut(id: string, dto: CheckOutDto, cashierId: string) {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ check-out Ä‘Æ¡n Ä‘áº·t phÃ²ng Ä‘ang á»Ÿ tráº¡ng thÃ¡i CHECKED_IN');
    }

    const settlement = this.buildSettlement(booking, dto);
    const collected = roundMoney(dto.amountCollected ?? 0);

    if (collected > settlement.amountDue) {
      throw new BadRequestException(
        `Sá»‘ tiá»n thu (${collected.toLocaleString('vi-VN')}Ä‘) vÆ°á»£t quÃ¡ sá»‘ cÃ²n pháº£i thu ` +
          `(${settlement.amountDue.toLocaleString('vi-VN')}Ä‘). ` +
          'Gá»i GET /bookings/:id/checkout-preview Ä‘á»ƒ láº¥y Ä‘Ãºng sá»‘ cÃ²n thu.',
      );
    }

    // Kiá»ƒm tra thanh toÃ¡n: Náº¿u cÃ²n tiá»n pháº£i thu, báº¯t buá»™c pháº£i thu Ä‘á»§ trÆ°á»›c khi hoÃ n táº¥t tráº£ phÃ²ng vÃ  Ä‘á»•i tráº¡ng thÃ¡i phÃ²ng
    if (settlement.amountDue > 0 && collected < settlement.amountDue) {
      throw new BadRequestException(
        `HÃ³a Ä‘Æ¡n chÆ°a Ä‘Æ°á»£c thanh toÃ¡n Ä‘á»§. CÃ²n thiáº¿u (${(settlement.amountDue - collected).toLocaleString('vi-VN')}Ä‘). ` +
          'Vui lÃ²ng kiá»ƒm tra vÃ  thu Ä‘á»§ thanh toÃ¡n trÆ°á»›c khi tráº£ phÃ²ng vÃ  chuyá»ƒn tráº¡ng thÃ¡i phÃ²ng.',
      );
    }

    const now = new Date();
    const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const { updatedBooking, invoice } = await this.prisma.$transaction(async (tx) => {
      // Ghi chÃº náº¿u lÃ  tráº£ phÃ²ng trÆ°á»›c háº¡n
      let specialRequests = booking.specialRequests;
      if (settlement.isEarlyCheckOut) {
        const note = `[Tráº£ phÃ²ng trÆ°á»›c háº¡n lÃºc ${now.toLocaleString('vi-VN')}: LÆ°u trÃº thá»±c táº¿ ${settlement.actualNights}/${settlement.bookedNights} Ä‘Ãªm. Tiá»n phÃ²ng: ${settlement.roomAmount.toLocaleString('vi-VN')}Ä‘${settlement.refundDue > 0 ? `, ÄÃ£ hoÃ n tráº£: ${settlement.refundDue.toLocaleString('vi-VN')}Ä‘` : ''}]`;
        specialRequests = specialRequests ? `${specialRequests}\n${note}` : note;
      }

      const bookingRow = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CHECKED_OUT,
          actualCheckOut: now,
          checkOutDate: settlement.isEarlyCheckOut ? now : undefined,
          totalAmount: settlement.isEarlyCheckOut ? settlement.roomAmount : undefined,
          specialRequests,
        },
        include: BOOKING_INCLUDE,
      });

      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.CLEANING },
      });

      // HÃ³a Ä‘Æ¡n chá»‰ chá»‘t Sá» TIá»€N PHáº¢I TRáº¢. Sá»‘ Ä‘Ã£ thu tuyá»‡t Ä‘á»‘i khÃ´ng ghi Ä‘Ã¨ á»Ÿ Ä‘Ã¢y:
      // nÃ³ Ä‘Æ°á»£c tÃ­nh láº¡i tá»« sá»• thu tiá»n, nÃªn tiá»n cá»c vÃ  cÃ¡c láº§n khÃ¡ch Ä‘Ã£ tráº£ qua
      // app váº«n cÃ²n nguyÃªn, vÃ  pháº§n cÃ²n thiáº¿u hiá»‡n Ä‘Ãºng trong "HÃ³a Ä‘Æ¡n cá»§a tÃ´i".
      const invoiceRow = await tx.invoice.upsert({
        where: { bookingId: id },
        create: {
          invoiceCode,
          bookingId: id,
          roomAmount: settlement.roomAmount,
          servicesAmount: settlement.servicesAmount,
          discount: settlement.discount,
          tax: settlement.tax,
          finalAmount: settlement.finalAmount,
          paidAmount: 0,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          paymentStatus: PaymentStatus.UNPAID,
          issuedById: cashierId,
        },
        update: {
          roomAmount: settlement.roomAmount,
          servicesAmount: settlement.servicesAmount,
          discount: settlement.discount,
          tax: settlement.tax,
          finalAmount: settlement.finalAmount,
          issuedById: cashierId,
        },
      });

      const activeShift = cashierId
        ? await tx.workShift.findFirst({
            where: { staffId: cashierId, status: ShiftStatus.OPEN },
            select: { id: true },
          })
        : null;

      // 1. Thu thÃªm tiá»n náº¿u cÃ³ (collected > 0)
      if (collected > 0) {
        await tx.payment.create({
          data: {
            invoiceId: invoiceRow.id,
            amount: collected,
            method: dto.paymentMethod || PaymentMethod.CASH,
            type: PaymentEntryType.PAYMENT,
            status: PaymentEntryStatus.CONFIRMED,
            note: dto.note || 'Thu tiá»n táº¡i quáº§y khi khÃ¡ch tráº£ phÃ²ng',
            createdById: cashierId,
            confirmedById: cashierId,
            confirmedAt: now,
            shiftId: activeShift?.id || null,
          },
        });
      }

      // 2. HoÃ n tiá»n náº¿u khÃ¡ch tráº£ phÃ²ng trÆ°á»›c vÃ  Ä‘Ã£ thanh toÃ¡n thá»«a (refundAmount > 0 hoáº·c settlement.refundDue > 0)
      const refundToProcess = roundMoney(
        dto.refundAmount !== undefined ? dto.refundAmount : settlement.refundDue,
      );
      if (refundToProcess > 0) {
        await tx.payment.create({
          data: {
            invoiceId: invoiceRow.id,
            amount: refundToProcess,
            method: dto.refundMethod || dto.paymentMethod || PaymentMethod.CASH,
            type: PaymentEntryType.REFUND,
            status: PaymentEntryStatus.CONFIRMED,
            note: dto.refundReason || `HoÃ n tiá»n tráº£ phÃ²ng trÆ°á»›c háº¡n (${refundToProcess.toLocaleString('vi-VN')}Ä‘)`,
            createdById: cashierId,
            confirmedById: cashierId,
            confirmedAt: now,
            shiftId: activeShift?.id || null,
          },
        });
      }

      const settledInvoice = await this.invoices.recalculateInvoiceTotals(
        tx,
        invoiceRow.id,
      );

      return { updatedBooking: bookingRow, invoice: settledInvoice };
    });

    // KhÃ¡ch Ä‘Ã£ tráº£ phÃ²ng: phÃ²ng sang CLEANING chá» buá»“ng phÃ²ng dá»n xong
    // (khÃ´ng suy diá»…n láº¡i tá»« lá»‹ch Ä‘áº·t, trÃ¡nh nháº£y tháº³ng sang RESERVED khi cÃ²n Ä‘Æ¡n Ä‘áº·t sau Ä‘Ã³).
    await this.reindexRoom(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');

    if (updatedBooking.room) {
      this.roomEvents.emitStatusChanged({
        id: updatedBooking.room.id,
        roomNumber: updatedBooking.room.roomNumber,
        floor: updatedBooking.room.floor,
        status: RoomStatus.CLEANING,
        previousStatus: booking.room?.status,
        roomTypeId: updatedBooking.room.roomTypeId,
        roomTypeName: updatedBooking.room.roomType?.name,
        roomTypeCode: updatedBooking.room.roomType?.code,
        pricePerNight: updatedBooking.room.roomType?.basePrice,
        notes: updatedBooking.room.notes,
        updatedAt: new Date().toISOString(),
      });
    }

    const remainingAmount = Math.max(
      0,
      roundMoney(invoice.finalAmount) - roundMoney(invoice.paidAmount),
    );

    this.notificationsService.sendToUser(booking.customerId, {
      title: 'Trả phòng thành công',
      body: `Cảm ơn Quý khách đã nghỉ dưỡng tại phòng ${booking.room?.roomNumber ?? ''}. Hẹn gặp lại Quý khách tại Luxe Grand Hotel!`,
      category: 'booking',
      actionRoute: '/my-bookings',
      actionLabel: 'Chi tiết đơn',
      data: {
        type: 'CHECK_OUT_SUCCESS',
        bookingId: booking.id,
      },
    }).catch(() => {});

    return {
      message:
        settlement.refundDue > 0
          ? `Check-out thÃ nh cÃ´ng. ÄÃ£ hoÃ n tráº£ láº¡i ${settlement.refundDue.toLocaleString('vi-VN')}Ä‘ cho khÃ¡ch.`
          : remainingAmount > 0
          ? `Check-out thÃ nh cÃ´ng. HÃ³a Ä‘Æ¡n cÃ²n thiáº¿u ${remainingAmount.toLocaleString('vi-VN')}Ä‘ ` +
            'Ä‘Ã£ Ä‘Æ°á»£c gá»­i vá» má»¥c "HÃ³a Ä‘Æ¡n cá»§a tÃ´i" Ä‘á»ƒ khÃ¡ch thanh toÃ¡n ná»‘t.'
          : 'Check-out vÃ  thanh toÃ¡n hÃ³a Ä‘Æ¡n thÃ nh cÃ´ng',
      invoiceId: invoice.id,
      /** Sá»‘ thu ngÃ¢n vá»«a thu táº¡i quáº§y. */
      amountCollected: collected,
      /** Sá»‘ tiá»n hoÃ n tráº£ cho khÃ¡ch (náº¿u cÃ³). */
      refundAmount: settlement.refundDue,
      /** ÄÆ¡n cÃ³ pháº£i tráº£ phÃ²ng trÆ°á»›c háº¡n khÃ´ng. */
      isEarlyCheckOut: settlement.isEarlyCheckOut,
      /** Sá»‘ khÃ¡ch cÃ²n ná»£ sau khi tráº£ phÃ²ng â€” 0 nghÄ©a lÃ  Ä‘Ã£ thanh toÃ¡n Ä‘á»§. */
      remainingAmount,
      settlement,
      booking: this.toBookingResponse({
        ...updatedBooking,
        invoice,
        // PhÃ²ng vá»«a Ä‘Æ°á»£c chuyá»ƒn sang CLEANING trong cÃ¹ng transaction
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
      throw new BadRequestException('KhÃ¡ch Ä‘ang á»Ÿ phÃ²ng, khÃ´ng thá»ƒ há»§y Ä‘Æ¡n Ä‘áº·t');
    }
    if (booking.status === BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ hoÃ n táº¥t, khÃ´ng thá»ƒ há»§y');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y trÆ°á»›c Ä‘Ã³');
    }

    // Lá»… tÃ¢n Ä‘Ã£ xÃ¡c nháº­n Ä‘Æ¡n (CONFIRMED) lÃ  phÃ²ng Ä‘Ã£ bá»‹ giá»¯ chá»— vÃ  tiá»n cá»c Ä‘Ã£ ghi nháº­n,
    // nÃªn khÃ¡ch khÃ´ng Ä‘Æ°á»£c tá»± há»§y ná»¯a â€” pháº£i qua lá»… tÃ¢n Ä‘á»ƒ xá»­ lÃ½ cá»c/hoÃ n tiá»n.
    // ÄÆ¡n Ä‘Ã£ nháº­n phÃ²ng thÃ¬ má»i vai trÃ² Ä‘á»u bá»‹ cháº·n á»Ÿ cÃ¡c kiá»ƒm tra phÃ­a trÃªn.
    if (currentUserRole === Role.CUSTOMER && booking.status !== BookingStatus.PENDING) {
      throw new ForbiddenException(
        'ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ Ä‘Æ°á»£c lá»… tÃ¢n xÃ¡c nháº­n nÃªn khÃ´ng thá»ƒ tá»± há»§y. ' +
          'Vui lÃ²ng liÃªn há»‡ lá»… tÃ¢n Ä‘á»ƒ Ä‘Æ°á»£c há»— trá»£.',
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

    // Tráº£ phÃ²ng vá» Ä‘Ãºng tráº¡ng thÃ¡i theo cÃ¡c Ä‘Æ¡n cÃ²n hiá»‡u lá»±c (khÃ´ng Ã©p cá»©ng AVAILABLE)
    await this.syncRoomStatus(booking.roomId);
    await this.redis.delByPattern('cache:rooms:*');

    return this.toBookingResponse(updatedBooking, currentUserRole);
  }

  async addServiceOrder(id: string, dto: AddServiceOrderDto) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ thÃªm dá»‹ch vá»¥ cho khÃ¡ch Ä‘ang lÆ°u trÃº táº¡i phÃ²ng');
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
        status: 'CONFIRMED',
      },
    });
  }

  /**
   * Äá»•i phÃ²ng cho khÃ¡ch Ä‘ang lÆ°u trÃº (S2 - P1)
   * POST /bookings/:id/change-room
   */
  async changeRoom(id: string, dto: ChangeRoomDto) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ Ä‘á»•i phÃ²ng cho Ä‘Æ¡n Ä‘áº·t phÃ²ng Ä‘ang lÆ°u trÃº (CHECKED_IN)');
    }

    if (dto.newRoomId === booking.roomId) {
      throw new BadRequestException('PhÃ²ng má»›i pháº£i khÃ¡c phÃ²ng hiá»‡n táº¡i Ä‘ang á»Ÿ');
    }

    const lockKey = `lock:room:${dto.newRoomId}`;
    const lockToken = await this.redis.acquireLock(lockKey, 5000);
    if (!lockToken) {
      throw new ConflictException('PhÃ²ng má»›i Ä‘ang Ä‘Æ°á»£c xá»­ lÃ½ bá»Ÿi má»™t thao tÃ¡c khÃ¡c, vui lÃ²ng thá»­ láº¡i');
    }

    try {
      const now = new Date();

      // Láº¥y kÃ¨m cÃ¡c Ä‘Æ¡n cÃ²n hiá»‡u lá»±c Ä‘á»ƒ suy ra tráº¡ng thÃ¡i THá»°C Táº¾ cá»§a phÃ²ng má»›i.
      // Cá»™t `room.status` cÃ³ thá»ƒ Ä‘Ã£ lá»‡ch (vÃ­ dá»¥ váº«n cÃ²n OCCUPIED sau khi khÃ¡ch cÅ©
      // Ä‘Ã£ tráº£ phÃ²ng / Ä‘Æ¡n bá»‹ há»§y), nÃªn khÃ´ng Ä‘Æ°á»£c dÃ¹ng trá»±c tiáº¿p Ä‘á»ƒ cháº·n Ä‘á»•i phÃ²ng â€”
      // lá»… tÃ¢n nhÃ¬n tháº¥y phÃ²ng trá»‘ng trÃªn sÆ¡ Ä‘á»“ nhÆ°ng láº¡i bá»‹ bÃ¡o "PhÃ²ng khÃ´ng kháº£ dá»¥ng".
      const newRoom = await this.prisma.room.findUnique({
        where: { id: dto.newRoomId },
        include: {
          roomType: true,
          bookings: {
            where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
            select: { status: true, checkInDate: true, checkOutDate: true },
          },
        },
      });

      if (!newRoom) {
        throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y phÃ²ng má»›i vá»›i ID: ${dto.newRoomId}`);
      }

      const effectiveStatus = deriveRoomStatus(newRoom.status, newRoom.bookings, now);

      // Cá»™t tráº¡ng thÃ¡i Ä‘Ã£ lá»‡ch: chá»¯a láº¡i ngay Ä‘á»ƒ sÆ¡ Ä‘á»“ phÃ²ng khÃ´ng tiáº¿p tá»¥c hiá»ƒn thá»‹ sai
      if (effectiveStatus !== newRoom.status) {
        await this.syncRoomStatus(dto.newRoomId);
      }

      if (effectiveStatus === RoomStatus.MAINTENANCE) {
        throw new BadRequestException(`PhÃ²ng ${newRoom.roomNumber} Ä‘ang báº£o trÃ¬, khÃ´ng thá»ƒ chuyá»ƒn vÃ o`);
      }

      if (
        effectiveStatus === RoomStatus.PENDING_APPROVAL ||
        effectiveStatus === RoomStatus.REJECTED
      ) {
        throw new BadRequestException(
          `PhÃ²ng ${newRoom.roomNumber} chÆ°a Ä‘Æ°á»£c duyá»‡t Ä‘Æ°a vÃ o khai thÃ¡c, khÃ´ng thá»ƒ chuyá»ƒn khÃ¡ch vÃ o`,
        );
      }

      if (effectiveStatus === RoomStatus.CLEANING) {
        throw new BadRequestException(
          `PhÃ²ng ${newRoom.roomNumber} Ä‘ang Ä‘Æ°á»£c dá»n dáº¹p, vui lÃ²ng chá» buá»“ng phÃ²ng hoÃ n táº¥t`,
        );
      }

      // OCCUPIED / RESERVED khÃ´ng bá»‹ cháº·n cá»©ng theo tráº¡ng thÃ¡i: chá»‰ cháº·n khi thá»±c sá»± cÃ³ Ä‘Æ¡n
      // chá»“ng láº¥n khoáº£ng lÆ°u trÃº cÃ²n láº¡i (tá»« bÃ¢y giá» tá»›i ngÃ y tráº£ phÃ²ng cá»§a khÃ¡ch).
      const conflictBooking = await this.prisma.booking.findFirst({
        where: {
          id: { not: id },
          roomId: dto.newRoomId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
          checkInDate: { lt: booking.checkOutDate },
          checkOutDate: { gt: now },
        },
        orderBy: { checkInDate: 'asc' },
      });

      if (conflictBooking) {
        throw new ConflictException(
          conflictBooking.status === BookingStatus.CHECKED_IN
            ? `PhÃ²ng ${newRoom.roomNumber} Ä‘ang cÃ³ khÃ¡ch lÆ°u trÃº, khÃ´ng thá»ƒ chuyá»ƒn vÃ o`
            : `PhÃ²ng ${newRoom.roomNumber} Ä‘Ã£ cÃ³ lá»‹ch Ä‘áº·t tá»« ${new Date(conflictBooking.checkInDate).toLocaleString('vi-VN')} trong khoáº£ng lÆ°u trÃº cÃ²n láº¡i`,
        );
      }

      let newTotalAmount = booking.totalAmount;
      if (dto.keepPrice === false) {
        const remainingNights = Math.max(1, Math.ceil((new Date(booking.checkOutDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const totalNights = Math.max(1, Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
        const passedNights = Math.max(0, totalNights - remainingNights);
        const oldBasePrice = booking.room.roomType.basePrice;
        const newBasePrice = newRoom.roomType.basePrice;
        newTotalAmount = roundMoney((passedNights * oldBasePrice) + (remainingNights * newBasePrice));
      }

      const oldRoomId = booking.roomId;
      const note = `[Äá»•i phÃ²ng: tá»« ${booking.room.roomNumber} sang ${newRoom.roomNumber} lÃºc ${new Date().toLocaleString('vi-VN')}. LÃ½ do: ${dto.reason}]`;
      const updatedRequests = booking.specialRequests ? `${booking.specialRequests}\n${note}` : note;

      const [updatedBooking] = await this.prisma.$transaction([
        this.prisma.booking.update({
          where: { id },
          data: {
            roomId: dto.newRoomId,
            totalAmount: newTotalAmount,
            specialRequests: updatedRequests,
          },
          include: BOOKING_INCLUDE,
        }),
        this.prisma.room.update({
          where: { id: oldRoomId },
          data: { status: RoomStatus.CLEANING },
        }),
        this.prisma.room.update({
          where: { id: dto.newRoomId },
          data: { status: RoomStatus.OCCUPIED },
        }),
      ]);

      // Cáº­p nháº­t láº¡i hÃ³a Ä‘Æ¡n táº¡m tÃ­nh náº¿u cÃ³ vÃ  tiá»n phÃ²ng thay Ä‘á»•i
      if (booking.invoice && dto.keepPrice === false) {
        const servicesTotal = booking.serviceOrders
          .filter((s) => s.status === 'CONFIRMED' || !s.status)
          .reduce((sum, s) => sum + s.totalPrice, 0);
        const taxable = Math.max(0, newTotalAmount + servicesTotal - booking.invoice.discount);
        const tax = taxable * 0.1;
        const finalAmount = taxable + tax;
        await this.prisma.invoice.update({
          where: { bookingId: id },
          data: {
            roomAmount: newTotalAmount,
            tax,
            finalAmount,
          },
        });
      }

      await this.reindexRoom(oldRoomId);
      await this.reindexRoom(dto.newRoomId);
      await this.redis.delByPattern('cache:rooms:*');

      this.roomEvents.emitStatusChanged({
        id: booking.room.id,
        roomNumber: booking.room.roomNumber,
        floor: booking.room.floor,
        status: RoomStatus.CLEANING,
        previousStatus: booking.room.status,
        roomTypeId: booking.room.roomTypeId,
        roomTypeName: booking.room.roomType?.name,
        roomTypeCode: booking.room.roomType?.code,
        pricePerNight: booking.room.roomType?.basePrice,
        notes: booking.room.notes,
        updatedAt: new Date().toISOString(),
      });
      this.roomEvents.emitStatusChanged({
        id: newRoom.id,
        roomNumber: newRoom.roomNumber,
        floor: newRoom.floor,
        status: RoomStatus.OCCUPIED,
        previousStatus: effectiveStatus,
        roomTypeId: newRoom.roomTypeId,
        roomTypeName: newRoom.roomType?.name,
        roomTypeCode: newRoom.roomType?.code,
        pricePerNight: newRoom.roomType?.basePrice,
        notes: newRoom.notes,
        updatedAt: new Date().toISOString(),
      });

      return {
        message: 'Äá»•i phÃ²ng thÃ nh cÃ´ng',
        booking: this.toBookingResponse(updatedBooking),
      };
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * KhÃ¡ch hÃ ng gá»­i yÃªu cáº§u dá»‹ch vá»¥ phÃ²ng (C1 - P1)
   * POST /bookings/:id/service-requests
   */
  async requestServiceOrder(id: string, dto: RequestServiceDto, customerId: string) {
    const booking = await this.findOne(id);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Báº¡n chá»‰ cÃ³ thá»ƒ yÃªu cáº§u dá»‹ch vá»¥ cho Ä‘Æ¡n Ä‘áº·t phÃ²ng cá»§a chÃ­nh mÃ¬nh');
    }
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ gá»i dá»‹ch vá»¥ khi Ä‘ang nháº­n phÃ²ng lÆ°u trÃº (CHECKED_IN)');
    }

    const quantity = dto.quantity || 1;
    const totalPrice = roundMoney(dto.unitPrice * quantity);

    return this.prisma.extraServiceOrder.create({
      data: {
        bookingId: id,
        serviceName: dto.serviceName,
        unitPrice: dto.unitPrice,
        quantity,
        totalPrice,
        status: 'REQUESTED',
        requestedById: customerId,
        note: dto.note || null,
      },
    });
  }

  /**
   * Lá»… tÃ¢n / Admin xÃ¡c nháº­n hoáº·c tá»« chá»‘i yÃªu cáº§u dá»‹ch vá»¥ (C1 - P1)
   * PATCH /bookings/:id/services/:orderId
   */
  async updateServiceOrderStatus(bookingId: string, orderId: string, dto: UpdateServiceOrderStatusDto) {
    const order = await this.prisma.extraServiceOrder.findFirst({
      where: { id: orderId, bookingId },
    });
    if (!order) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y yÃªu cáº§u dá»‹ch vá»¥ vá»›i ID: ${orderId}`);
    }

    const updatedNote = dto.note ? (order.note ? `${order.note} | ${dto.note}` : dto.note) : order.note;

    return this.prisma.extraServiceOrder.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        note: updatedNote,
      },
    });
  }

  /**
   * Gửi thông báo nhắc nhở trả phòng cho khách hàng của một đơn đặt phòng
   */
  async notifyCheckoutReminder(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: { select: { roomNumber: true } },
        customer: { select: { id: true, fullName: true, fcmToken: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy đơn đặt phòng #${bookingId}`);
    }

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        `Đơn đặt phòng đang ở trạng thái ${booking.status}, chỉ có thể gửi nhắc nhở trả phòng cho khách đang lưu trú (CHECKED_IN).`,
      );
    }

    const roomNumber = booking.room?.roomNumber ?? 'phòng';
    const checkOutDate = new Date(booking.checkOutDate);
    const hours = checkOutDate.getHours().toString().padStart(2, '0');
    const minutes = checkOutDate.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const title = `Nhắc nhở trả phòng • Phòng ${roomNumber}`;
    const body = `Phòng ${roomNumber} của Quý khách có giờ trả phòng dự kiến lúc ${timeStr} hôm nay. Quý khách vui lòng kiểm tra hành lý hoặc liên hệ lễ tân để được hỗ trợ gia hạn.`;

    const sent = await this.notificationsService.sendToUser(booking.customerId, {
      title,
      body,
      category: 'Nhắc nhở trả phòng',
      data: {
        type: 'CHECKOUT_REMINDER',
        bookingId: booking.id,
        roomNumber: String(roomNumber),
      },
    });

    return {
      success: sent,
      message: sent
        ? `Đã gửi thông báo nhắc trả phòng tới khách hàng ${booking.customer.fullName}`
        : `Khách hàng ${booking.customer.fullName} chưa đăng ký thiết bị nhận thông báo (chưa có FCM token)`,
      bookingId: booking.id,
      roomNumber,
      hasFcmToken: !!booking.customer.fcmToken,
    };
  }

  /**
   * Tự động gửi thông báo nhắc trả phòng cho tất cả các phòng có lịch trả phòng hôm nay
   */
  async notifyAllTodayCheckouts() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const todayBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CHECKED_IN,
        checkOutDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        room: { select: { roomNumber: true } },
        customer: { select: { id: true, fullName: true, fcmToken: true } },
      },
    });

    let sentCount = 0;
    for (const b of todayBookings) {
      if (b.customer.fcmToken) {
        const roomNumber = b.room?.roomNumber ?? 'phòng';
        const checkOutDate = new Date(b.checkOutDate);
        const hours = checkOutDate.getHours().toString().padStart(2, '0');
        const minutes = checkOutDate.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        await this.notificationsService.sendToUser(b.customerId, {
          title: `Nhắc nhở trả phòng • Phòng ${roomNumber}`,
          body: `Phòng ${roomNumber} của Quý khách có giờ trả phòng dự kiến lúc ${timeStr} hôm nay. Quý khách vui lòng kiểm tra hành lý hoặc liên hệ lễ tân để gia hạn.`,
          category: 'Nhắc nhở trả phòng',
          data: {
            type: 'CHECKOUT_REMINDER',
            bookingId: b.id,
            roomNumber: String(roomNumber),
          },
        });
        sentCount++;
      }
    }

    return {
      message: `Đã xử lý thông báo trả phòng cho ${todayBookings.length} phòng hôm nay`,
      totalDueToday: todayBookings.length,
      notificationsSent: sentCount,
    };
  }
}