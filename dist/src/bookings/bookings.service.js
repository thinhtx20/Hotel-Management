"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BookingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const elasticsearch_service_1 = require("../elasticsearch/elasticsearch.service");
const revenue_util_1 = require("../common/utils/revenue.util");
const room_status_util_1 = require("../common/utils/room-status.util");
const pagination_util_1 = require("../common/utils/pagination.util");
const client_1 = require("@prisma/client");
const room_events_service_1 = require("../rooms/room-events.service");
const invoices_service_1 = require("../invoices/invoices.service");
const notifications_service_1 = require("../notifications/notifications.service");
const BOOKING_INCLUDE = {
    customer: { select: { id: true, fullName: true, email: true, phone: true } },
    room: { include: { roomType: true } },
    invoice: true,
    serviceOrders: true,
    confirmedBy: { select: { id: true, fullName: true, role: true } },
    cancelledBy: { select: { id: true, fullName: true, role: true } },
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
let BookingsService = BookingsService_1 = class BookingsService {
    constructor(prisma, redis, esService, roomEvents, invoices, notificationsService) {
        this.prisma = prisma;
        this.redis = redis;
        this.esService = esService;
        this.roomEvents = roomEvents;
        this.invoices = invoices;
        this.notificationsService = notificationsService;
        this.logger = new common_1.Logger(BookingsService_1.name);
    }
    async reindexRoom(roomId) {
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
            include: { roomType: true },
        });
        if (room) {
            await this.esService.indexRoomEntity(room);
        }
    }
    async syncRoomStatus(roomId) {
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
            include: {
                bookings: {
                    where: { status: { in: [client_1.BookingStatus.CHECKED_IN, client_1.BookingStatus.CONFIRMED] } },
                    select: { status: true, checkInDate: true, checkOutDate: true },
                },
            },
        });
        if (!room)
            return null;
        const nextStatus = (0, room_status_util_1.deriveRoomStatus)(room.status, room.bookings);
        if (nextStatus === room.status)
            return room.status;
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
    async create(dto, currentUserId, currentUserRole) {
        const rawCheckIn = new Date(dto.checkInDate);
        const rawCheckOut = new Date(dto.checkOutDate);
        if (rawCheckIn >= rawCheckOut) {
            throw new common_1.BadRequestException('NgÃ y nháº­n phÃ²ng pháº£i trÆ°á»›c ngÃ y tráº£ phÃ²ng');
        }
        const checkIn = new Date(rawCheckIn);
        checkIn.setUTCHours(14, 0, 0, 0);
        const checkOut = new Date(rawCheckOut);
        checkOut.setUTCHours(12, 0, 0, 0);
        const lockKey = `lock:booking:room:${dto.roomId}`;
        const lockToken = await this.redis.acquireLock(lockKey, 6000);
        if (!lockToken) {
            this.logger.warn(`Conflict lock trÃªn phÃ²ng ${dto.roomId} bá»Ÿi request Ä‘á»“ng thá»i`);
            throw new common_1.ConflictException('PhÃ²ng nÃ y Ä‘ang Ä‘Æ°á»£c khÃ¡ch khÃ¡c giá»¯ chá»— Ä‘á»ƒ thanh toÃ¡n, vui lÃ²ng thá»­ láº¡i sau giÃ¢y lÃ¡t!');
        }
        try {
            const room = await this.prisma.room.findUnique({
                where: { id: dto.roomId },
                include: { roomType: true },
            });
            if (!room) {
                throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y phÃ²ng vá»›i ID: ${dto.roomId}`);
            }
            if (room.status === client_1.RoomStatus.MAINTENANCE) {
                throw new common_1.BadRequestException('PhÃ²ng nÃ y hiá»‡n Ä‘ang báº£o trÃ¬, khÃ´ng thá»ƒ Ä‘áº·t');
            }
            const now = new Date();
            const conflictBooking = await this.prisma.booking.findFirst({
                where: {
                    roomId: dto.roomId,
                    status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
                    checkOutDate: { gt: now },
                    AND: [
                        { checkInDate: { lt: checkOut } },
                        { checkOutDate: { gt: checkIn } },
                    ],
                },
            });
            if (conflictBooking) {
                throw new common_1.ConflictException('PhÃ²ng nÃ y Ä‘Ã£ cÃ³ khÃ¡ch Ä‘áº·t hoáº·c Ä‘ang á»Ÿ trong khoáº£ng thá»i gian Ä‘Æ°á»£c chá»n');
            }
            const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
            const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            const totalAmount = nights * room.roomType.basePrice;
            const finalCustomerId = currentUserRole === client_1.Role.CUSTOMER ? currentUserId : dto.customerId || currentUserId;
            let initialStatus = client_1.BookingStatus.PENDING;
            if (currentUserRole !== client_1.Role.CUSTOMER) {
                initialStatus = dto.status || client_1.BookingStatus.CONFIRMED;
            }
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
                    ...(initialStatus === client_1.BookingStatus.CONFIRMED
                        ? { confirmedAt: new Date(), confirmedById: currentUserId }
                        : {}),
                },
                include: BOOKING_INCLUDE,
            });
            await this.syncRoomStatus(dto.roomId);
            await this.redis.delByPattern('cache:rooms:*');
            this.notificationsService.sendToUser(finalCustomerId, {
                title: initialStatus === client_1.BookingStatus.CONFIRMED ? 'Xác nhận đặt phòng' : 'Đơn đặt phòng mới',
                body: `Đơn đặt phòng ${booking.bookingCode} (${room?.roomNumber ? 'Phòng ' + room.roomNumber : ''}) đã được tạo thành công.`,
                category: 'booking',
                actionRoute: '/my-bookings',
                actionLabel: 'Xem chuyến đi',
                data: {
                    type: 'BOOKING_CREATED',
                    bookingId: booking.id,
                },
            }).catch(() => { });
            return this.toBookingResponse(booking, currentUserRole);
        }
        finally {
            await this.redis.releaseLock(lockKey, lockToken);
        }
    }
    toBookingResponse(b, viewerRole) {
        const checkIn = new Date(b.checkInDate);
        const checkOut = new Date(b.checkOutDate);
        const diff = Math.abs(checkOut.getTime() - checkIn.getTime());
        const nights = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        const paymentStatus = b.invoice?.paymentStatus || (b.depositAmount > 0 ? 'PARTIAL' : 'UNPAID');
        const invoiceId = b.invoice?.id || null;
        const canCancel = viewerRole === client_1.Role.CUSTOMER
            ? b.status === client_1.BookingStatus.PENDING
            : b.status === client_1.BookingStatus.PENDING || b.status === client_1.BookingStatus.CONFIRMED;
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
            cancellationReason: b.cancellationReason ?? null,
            cancelledAt: b.cancelledAt ?? null,
            cancelledBy: b.cancelledBy ?? null,
            confirmedAt: b.confirmedAt ?? null,
            confirmedBy: b.confirmedBy ?? null,
            confirmationNote: b.confirmationNote ?? null,
        };
    }
    async findAll(query = {}, viewerRole) {
        const where = {};
        if (query.status && query.status.length > 0) {
            where.status =
                query.status.length === 1 ? query.status[0] : { in: query.status };
        }
        if (query.customerId)
            where.customerId = query.customerId;
        if (query.roomId)
            where.roomId = query.roomId;
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
            const insensitive = client_1.Prisma.QueryMode.insensitive;
            where.OR = [
                { bookingCode: { contains: search, mode: insensitive } },
                { customer: { fullName: { contains: search, mode: insensitive } } },
                { customer: { phone: { contains: search, mode: insensitive } } },
                { customer: { email: { contains: search, mode: insensitive } } },
                { room: { roomNumber: { contains: search, mode: insensitive } } },
            ];
        }
        const { isPaginated, page, limit, skip, take } = (0, pagination_util_1.calculatePagination)(query);
        const [total, list] = await this.prisma.$transaction([
            this.prisma.booking.count({ where }),
            this.prisma.booking.findMany({
                where,
                include: BOOKING_INCLUDE,
                orderBy: { createdAt: 'desc' },
                ...(isPaginated ? { skip, take } : {}),
            }),
        ]);
        const data = list.map((b) => this.toBookingResponse(b, viewerRole));
        return (0, pagination_util_1.buildPaginatedResult)(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
    }
    assertOwnership(booking, userId, userRole) {
        if (userRole === client_1.Role.CUSTOMER && booking.customerId !== userId) {
            throw new common_1.ForbiddenException('Báº¡n chá»‰ cÃ³ thá»ƒ xem vÃ  thao tÃ¡c trÃªn Ä‘Æ¡n Ä‘áº·t phÃ²ng cá»§a chÃ­nh mÃ¬nh');
        }
    }
    async findOne(id, currentUserId, currentUserRole) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: BOOKING_INCLUDE,
        });
        if (!booking) {
            throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n Ä‘áº·t phÃ²ng ID: ${id}`);
        }
        this.assertOwnership(booking, currentUserId, currentUserRole);
        return this.toBookingResponse(booking, currentUserRole);
    }
    async approve(id, dto, currentUserId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: BOOKING_INCLUDE,
        });
        if (!booking) {
            throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n Ä‘áº·t phÃ²ng ID: ${id}`);
        }
        if (booking.status === client_1.BookingStatus.CONFIRMED) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t trÆ°á»›c Ä‘Ã³');
        }
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y, khÃ´ng thá»ƒ phÃª duyá»‡t');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_IN || booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ hoáº·c Ä‘ang Ä‘Æ°á»£c thá»±c hiá»‡n, khÃ´ng thá»ƒ duyá»‡t láº¡i');
        }
        const targetRoomId = dto?.assignedRoomId || booking.roomId;
        const targetRoom = await this.prisma.room.findUnique({ where: { id: targetRoomId } });
        if (!targetRoom) {
            throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y phÃ²ng cáº§n xáº¿p vá»›i ID: ${targetRoomId}`);
        }
        if (targetRoom.status === client_1.RoomStatus.MAINTENANCE) {
            throw new common_1.BadRequestException('PhÃ²ng Ä‘Æ°á»£c xáº¿p Ä‘ang báº£o trÃ¬, khÃ´ng thá»ƒ nháº­n khÃ¡ch');
        }
        if (targetRoomId !== booking.roomId) {
            const conflict = await this.prisma.booking.findFirst({
                where: {
                    id: { not: id },
                    roomId: targetRoomId,
                    status: {
                        in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN],
                    },
                    AND: [
                        { checkInDate: { lt: booking.checkOutDate } },
                        { checkOutDate: { gt: booking.checkInDate } },
                    ],
                },
            });
            if (conflict) {
                throw new common_1.ConflictException(`PhÃ²ng ${targetRoom.roomNumber} Ä‘Ã£ cÃ³ Ä‘Æ¡n ${conflict.bookingCode} trÃ¹ng lá»‹ch trong khoáº£ng thá»i gian nÃ y`);
            }
        }
        const depositAmount = dto?.depositAmount !== undefined ? dto.depositAmount : (booking.depositAmount || 0);
        const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
        const { updatedBooking, invoice } = await this.prisma.$transaction(async (tx) => {
            const bookingRow = await tx.booking.update({
                where: { id },
                data: {
                    status: client_1.BookingStatus.CONFIRMED,
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
                    paymentMethod: dto?.paymentMethod || client_1.PaymentMethod.BANK_TRANSFER,
                    paymentStatus: client_1.PaymentStatus.UNPAID,
                    notes: dto?.notes || 'Tiá»n cá»c giá»¯ chá»— khi duyá»‡t phÃ²ng',
                    issuedById: currentUserId,
                },
                update: {
                    paymentMethod: dto?.paymentMethod || client_1.PaymentMethod.BANK_TRANSFER,
                    notes: dto?.notes || 'Tiá»n cá»c giá»¯ chá»— khi duyá»‡t phÃ²ng',
                    issuedById: currentUserId,
                },
            });
            await tx.payment.deleteMany({
                where: { invoiceId: invoiceRow.id, type: client_1.PaymentEntryType.DEPOSIT },
            });
            const activeShift = currentUserId
                ? await tx.workShift.findFirst({
                    where: { staffId: currentUserId, status: client_1.ShiftStatus.OPEN },
                    select: { id: true },
                })
                : null;
            await tx.payment.create({
                data: {
                    invoiceId: invoiceRow.id,
                    amount: (0, revenue_util_1.roundMoney)(depositAmount),
                    method: dto?.paymentMethod || client_1.PaymentMethod.BANK_TRANSFER,
                    type: client_1.PaymentEntryType.DEPOSIT,
                    status: client_1.PaymentEntryStatus.CONFIRMED,
                    note: 'Tiá»n cá»c giá»¯ chá»— khi duyá»‡t phÃ²ng',
                    createdById: currentUserId,
                    confirmedById: currentUserId,
                    confirmedAt: new Date(),
                    shiftId: activeShift?.id || null,
                },
            });
            const settledInvoice = await this.invoices.recalculateInvoiceTotals(tx, invoiceRow.id);
            return { updatedBooking: bookingRow, invoice: settledInvoice };
        });
        const targetRoomStatus = (await this.syncRoomStatus(targetRoomId)) ?? targetRoom.status;
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
        }).catch(() => { });
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
    async confirm(id, dto, currentUserId) {
        const result = await this.approve(id, dto, currentUserId);
        return {
            ...result,
            message: 'XÃ¡c nháº­n Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
        };
    }
    async reject(id, dto, currentUserId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: BOOKING_INCLUDE,
        });
        if (!booking) {
            throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n Ä‘áº·t phÃ²ng ID: ${id}`);
        }
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y trÆ°á»›c Ä‘Ã³');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_IN || booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('KhÃ´ng thá»ƒ tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ hoáº·c Ä‘ang lÆ°u trÃº');
        }
        const reason = dto?.cancellationReason || dto?.reason || null;
        const updatedBooking = await this.prisma.booking.update({
            where: { id },
            data: {
                status: client_1.BookingStatus.CANCELLED,
                cancellationReason: reason,
                cancelledAt: new Date(),
                cancelledById: currentUserId ?? null,
            },
            include: BOOKING_INCLUDE,
        });
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
        }).catch(() => { });
        return {
            message: 'Tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
            booking: this.toBookingResponse(updatedBooking),
        };
    }
    async checkIn(id) {
        const booking = await this.findOne(id);
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y');
        }
        if (booking.status === client_1.BookingStatus.PENDING) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘ang á»Ÿ tráº¡ng thÃ¡i chá» duyá»‡t. Lá»… tÃ¢n vui lÃ²ng phÃª duyá»‡t Ä‘Æ¡n trÆ°á»›c khi thá»±c hiá»‡n check-in');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('KhÃ¡ch Ä‘Ã£ check-in trÆ°á»›c Ä‘Ã³');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ hoÃ n táº¥t check-out');
        }
        const [updatedBooking] = await this.prisma.$transaction([
            this.prisma.booking.update({
                where: { id },
                data: {
                    status: client_1.BookingStatus.CHECKED_IN,
                    actualCheckIn: new Date(),
                },
                include: BOOKING_INCLUDE,
            }),
            this.prisma.room.update({
                where: { id: booking.roomId },
                data: { status: client_1.RoomStatus.OCCUPIED },
            }),
        ]);
        await this.reindexRoom(booking.roomId);
        await this.redis.delByPattern('cache:rooms:*');
        if (updatedBooking.room) {
            this.roomEvents.emitStatusChanged({
                id: updatedBooking.room.id,
                roomNumber: updatedBooking.room.roomNumber,
                floor: updatedBooking.room.floor,
                status: client_1.RoomStatus.OCCUPIED,
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
        }).catch(() => { });
        return this.toBookingResponse(updatedBooking);
    }
    buildSettlement(booking, dto) {
        const confirmedServices = booking.serviceOrders.filter((s) => s.status === 'CONFIRMED' || !s.status);
        const servicesTotal = (0, revenue_util_1.roundMoney)(confirmedServices.reduce((sum, s) => sum + s.totalPrice, 0));
        const checkIn = new Date(booking.actualCheckIn || booking.checkInDate);
        const scheduledCheckOut = new Date(booking.checkOutDate);
        const now = new Date();
        const bookedDiffTime = Math.abs(scheduledCheckOut.getTime() - checkIn.getTime());
        const bookedNights = Math.max(1, Math.ceil(bookedDiffTime / (1000 * 60 * 60 * 24)));
        const actualDiffTime = Math.abs(now.getTime() - checkIn.getTime());
        const actualNights = Math.max(1, Math.ceil(actualDiffTime / (1000 * 60 * 60 * 24)));
        const isEarlyCheckOut = now < scheduledCheckOut && actualNights < bookedNights;
        const basePrice = booking.room?.roomType?.basePrice ||
            (bookedNights > 0 ? (0, revenue_util_1.roundMoney)(booking.totalAmount / bookedNights) : booking.totalAmount);
        const originalRoomAmount = (0, revenue_util_1.roundMoney)(booking.totalAmount);
        const recalculatedRoomAmount = (0, revenue_util_1.roundMoney)(actualNights * basePrice);
        let roomAmount = originalRoomAmount;
        if (dto?.customRoomAmount !== undefined && dto.customRoomAmount >= 0) {
            roomAmount = (0, revenue_util_1.roundMoney)(dto.customRoomAmount);
        }
        else if (isEarlyCheckOut) {
            if (dto?.recalculateRoomAmount === false) {
                roomAmount = originalRoomAmount;
            }
            else {
                roomAmount = recalculatedRoomAmount;
            }
        }
        const discount = (0, revenue_util_1.roundMoney)(dto?.discount ?? booking.invoice?.discount ?? 0);
        const taxRate = dto?.taxRate !== undefined ? dto.taxRate : 0.1;
        const taxableAmount = Math.max(0, roomAmount + servicesTotal - discount);
        const tax = (0, revenue_util_1.roundMoney)(taxableAmount * taxRate);
        const finalAmount = (0, revenue_util_1.roundMoney)(taxableAmount + tax);
        const alreadyPaid = (0, revenue_util_1.roundMoney)(booking.invoice?.paidAmount ?? 0);
        const amountDue = Math.max(0, finalAmount - alreadyPaid);
        const refundDue = Math.max(0, alreadyPaid - finalAmount);
        return {
            roomAmount,
            servicesAmount: servicesTotal,
            discount,
            taxRate,
            tax,
            finalAmount,
            depositAmount: (0, revenue_util_1.roundMoney)(booking.depositAmount || 0),
            alreadyPaidAmount: alreadyPaid,
            amountDue,
            refundDue,
            isEarlyCheckOut,
            bookedNights,
            actualNights,
            basePrice,
            originalRoomAmount,
            recalculatedRoomAmount,
            serviceItems: confirmedServices.map((s) => ({
                id: s.id,
                name: s.serviceName,
                quantity: s.quantity,
                unitPrice: s.unitPrice,
                amount: s.totalPrice,
            })),
        };
    }
    async checkoutPreview(id) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.CHECKED_IN &&
            booking.status !== client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('Chá»‰ xem Ä‘Æ°á»£c báº£ng quyáº¿t toÃ¡n cá»§a Ä‘Æ¡n Ä‘ang lÆ°u trÃº (CHECKED_IN) hoáº·c Ä‘Ã£ tráº£ phÃ²ng (CHECKED_OUT)');
        }
        const settlement = this.buildSettlement(booking);
        const pendingRequests = booking.invoice
            ? await this.prisma.payment.findMany({
                where: { invoiceId: booking.invoice.id, status: client_1.PaymentEntryStatus.PENDING },
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
            pendingPaymentRequests: pendingRequests.map((p) => ({
                id: p.id,
                amount: p.amount,
                paymentMethod: p.method,
                reference: p.reference,
                note: p.note,
                requestedAt: p.createdAt,
            })),
            pendingPaymentAmount: (0, revenue_util_1.roundMoney)(pendingRequests.reduce((sum, p) => sum + p.amount, 0)),
        };
    }
    async checkOut(id, dto, cashierId) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Chá»‰ cÃ³ thá»ƒ check-out Ä‘Æ¡n Ä‘áº·t phÃ²ng Ä‘ang á»Ÿ tráº¡ng thÃ¡i CHECKED_IN');
        }
        const settlement = this.buildSettlement(booking, dto);
        const collected = (0, revenue_util_1.roundMoney)(dto.amountCollected ?? 0);
        if (collected > settlement.amountDue) {
            throw new common_1.BadRequestException(`Sá»‘ tiá»n thu (${collected.toLocaleString('vi-VN')}Ä‘) vÆ°á»£t quÃ¡ sá»‘ cÃ²n pháº£i thu ` +
                `(${settlement.amountDue.toLocaleString('vi-VN')}Ä‘). ` +
                'Gá»i GET /bookings/:id/checkout-preview Ä‘á»ƒ láº¥y Ä‘Ãºng sá»‘ cÃ²n thu.');
        }
        if (settlement.amountDue > 0 && collected < settlement.amountDue) {
            throw new common_1.BadRequestException(`HÃ³a Ä‘Æ¡n chÆ°a Ä‘Æ°á»£c thanh toÃ¡n Ä‘á»§. CÃ²n thiáº¿u (${(settlement.amountDue - collected).toLocaleString('vi-VN')}Ä‘). ` +
                'Vui lÃ²ng kiá»ƒm tra vÃ  thu Ä‘á»§ thanh toÃ¡n trÆ°á»›c khi tráº£ phÃ²ng vÃ  chuyá»ƒn tráº¡ng thÃ¡i phÃ²ng.');
        }
        const now = new Date();
        const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
        const { updatedBooking, invoice } = await this.prisma.$transaction(async (tx) => {
            let specialRequests = booking.specialRequests;
            if (settlement.isEarlyCheckOut) {
                const note = `[Tráº£ phÃ²ng trÆ°á»›c háº¡n lÃºc ${now.toLocaleString('vi-VN')}: LÆ°u trÃº thá»±c táº¿ ${settlement.actualNights}/${settlement.bookedNights} Ä‘Ãªm. Tiá»n phÃ²ng: ${settlement.roomAmount.toLocaleString('vi-VN')}Ä‘${settlement.refundDue > 0 ? `, ÄÃ£ hoÃ n tráº£: ${settlement.refundDue.toLocaleString('vi-VN')}Ä‘` : ''}]`;
                specialRequests = specialRequests ? `${specialRequests}\n${note}` : note;
            }
            const bookingRow = await tx.booking.update({
                where: { id },
                data: {
                    status: client_1.BookingStatus.CHECKED_OUT,
                    actualCheckOut: now,
                    checkOutDate: settlement.isEarlyCheckOut ? now : undefined,
                    totalAmount: settlement.isEarlyCheckOut ? settlement.roomAmount : undefined,
                    specialRequests,
                },
                include: BOOKING_INCLUDE,
            });
            await tx.room.update({
                where: { id: booking.roomId },
                data: { status: client_1.RoomStatus.CLEANING },
            });
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
                    paymentMethod: dto.paymentMethod || client_1.PaymentMethod.CASH,
                    paymentStatus: client_1.PaymentStatus.UNPAID,
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
                    where: { staffId: cashierId, status: client_1.ShiftStatus.OPEN },
                    select: { id: true },
                })
                : null;
            if (collected > 0) {
                await tx.payment.create({
                    data: {
                        invoiceId: invoiceRow.id,
                        amount: collected,
                        method: dto.paymentMethod || client_1.PaymentMethod.CASH,
                        type: client_1.PaymentEntryType.PAYMENT,
                        status: client_1.PaymentEntryStatus.CONFIRMED,
                        note: dto.note || 'Thu tiá»n táº¡i quáº§y khi khÃ¡ch tráº£ phÃ²ng',
                        createdById: cashierId,
                        confirmedById: cashierId,
                        confirmedAt: now,
                        shiftId: activeShift?.id || null,
                    },
                });
            }
            const refundToProcess = (0, revenue_util_1.roundMoney)(dto.refundAmount !== undefined ? dto.refundAmount : settlement.refundDue);
            if (refundToProcess > 0) {
                await tx.payment.create({
                    data: {
                        invoiceId: invoiceRow.id,
                        amount: refundToProcess,
                        method: dto.refundMethod || dto.paymentMethod || client_1.PaymentMethod.CASH,
                        type: client_1.PaymentEntryType.REFUND,
                        status: client_1.PaymentEntryStatus.CONFIRMED,
                        note: dto.refundReason || `HoÃ n tiá»n tráº£ phÃ²ng trÆ°á»›c háº¡n (${refundToProcess.toLocaleString('vi-VN')}Ä‘)`,
                        createdById: cashierId,
                        confirmedById: cashierId,
                        confirmedAt: now,
                        shiftId: activeShift?.id || null,
                    },
                });
            }
            const settledInvoice = await this.invoices.recalculateInvoiceTotals(tx, invoiceRow.id);
            return { updatedBooking: bookingRow, invoice: settledInvoice };
        });
        await this.reindexRoom(booking.roomId);
        await this.redis.delByPattern('cache:rooms:*');
        if (updatedBooking.room) {
            this.roomEvents.emitStatusChanged({
                id: updatedBooking.room.id,
                roomNumber: updatedBooking.room.roomNumber,
                floor: updatedBooking.room.floor,
                status: client_1.RoomStatus.CLEANING,
                previousStatus: booking.room?.status,
                roomTypeId: updatedBooking.room.roomTypeId,
                roomTypeName: updatedBooking.room.roomType?.name,
                roomTypeCode: updatedBooking.room.roomType?.code,
                pricePerNight: updatedBooking.room.roomType?.basePrice,
                notes: updatedBooking.room.notes,
                updatedAt: new Date().toISOString(),
            });
        }
        const remainingAmount = Math.max(0, (0, revenue_util_1.roundMoney)(invoice.finalAmount) - (0, revenue_util_1.roundMoney)(invoice.paidAmount));
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
        }).catch(() => { });
        return {
            message: settlement.refundDue > 0
                ? `Check-out thÃ nh cÃ´ng. ÄÃ£ hoÃ n tráº£ láº¡i ${settlement.refundDue.toLocaleString('vi-VN')}Ä‘ cho khÃ¡ch.`
                : remainingAmount > 0
                    ? `Check-out thÃ nh cÃ´ng. HÃ³a Ä‘Æ¡n cÃ²n thiáº¿u ${remainingAmount.toLocaleString('vi-VN')}Ä‘ ` +
                        'Ä‘Ã£ Ä‘Æ°á»£c gá»­i vá» má»¥c "HÃ³a Ä‘Æ¡n cá»§a tÃ´i" Ä‘á»ƒ khÃ¡ch thanh toÃ¡n ná»‘t.'
                    : 'Check-out vÃ  thanh toÃ¡n hÃ³a Ä‘Æ¡n thÃ nh cÃ´ng',
            invoiceId: invoice.id,
            amountCollected: collected,
            refundAmount: settlement.refundDue,
            isEarlyCheckOut: settlement.isEarlyCheckOut,
            remainingAmount,
            settlement,
            booking: this.toBookingResponse({
                ...updatedBooking,
                invoice,
                room: { ...updatedBooking.room, status: client_1.RoomStatus.CLEANING },
            }),
            invoice,
        };
    }
    async cancel(id, dto, currentUserId, currentUserRole) {
        const booking = await this.findOne(id, currentUserId, currentUserRole);
        if (booking.status === client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('KhÃ¡ch Ä‘ang á»Ÿ phÃ²ng, khÃ´ng thá»ƒ há»§y Ä‘Æ¡n Ä‘áº·t');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ hoÃ n táº¥t, khÃ´ng thá»ƒ há»§y');
        }
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ bá»‹ há»§y trÆ°á»›c Ä‘Ã³');
        }
        if (currentUserRole === client_1.Role.CUSTOMER && booking.status !== client_1.BookingStatus.PENDING) {
            throw new common_1.ForbiddenException('ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ Ä‘Æ°á»£c lá»… tÃ¢n xÃ¡c nháº­n nÃªn khÃ´ng thá»ƒ tá»± há»§y. ' +
                'Vui lÃ²ng liÃªn há»‡ lá»… tÃ¢n Ä‘á»ƒ Ä‘Æ°á»£c há»— trá»£.');
        }
        const updatedBooking = await this.prisma.booking.update({
            where: { id },
            data: {
                status: client_1.BookingStatus.CANCELLED,
                cancellationReason: dto?.cancellationReason || dto?.reason || null,
                cancelledAt: new Date(),
                cancelledById: currentUserId ?? null,
            },
            include: BOOKING_INCLUDE,
        });
        await this.syncRoomStatus(booking.roomId);
        await this.redis.delByPattern('cache:rooms:*');
        return this.toBookingResponse(updatedBooking, currentUserRole);
    }
    async addServiceOrder(id, dto) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Chá»‰ cÃ³ thá»ƒ thÃªm dá»‹ch vá»¥ cho khÃ¡ch Ä‘ang lÆ°u trÃº táº¡i phÃ²ng');
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
    async changeRoom(id, dto) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Chá»‰ cÃ³ thá»ƒ Ä‘á»•i phÃ²ng cho Ä‘Æ¡n Ä‘áº·t phÃ²ng Ä‘ang lÆ°u trÃº (CHECKED_IN)');
        }
        if (dto.newRoomId === booking.roomId) {
            throw new common_1.BadRequestException('PhÃ²ng má»›i pháº£i khÃ¡c phÃ²ng hiá»‡n táº¡i Ä‘ang á»Ÿ');
        }
        const lockKey = `lock:room:${dto.newRoomId}`;
        const lockToken = await this.redis.acquireLock(lockKey, 5000);
        if (!lockToken) {
            throw new common_1.ConflictException('PhÃ²ng má»›i Ä‘ang Ä‘Æ°á»£c xá»­ lÃ½ bá»Ÿi má»™t thao tÃ¡c khÃ¡c, vui lÃ²ng thá»­ láº¡i');
        }
        try {
            const now = new Date();
            const newRoom = await this.prisma.room.findUnique({
                where: { id: dto.newRoomId },
                include: {
                    roomType: true,
                    bookings: {
                        where: { status: { in: [client_1.BookingStatus.CHECKED_IN, client_1.BookingStatus.CONFIRMED] } },
                        select: { status: true, checkInDate: true, checkOutDate: true },
                    },
                },
            });
            if (!newRoom) {
                throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y phÃ²ng má»›i vá»›i ID: ${dto.newRoomId}`);
            }
            const effectiveStatus = (0, room_status_util_1.deriveRoomStatus)(newRoom.status, newRoom.bookings, now);
            if (effectiveStatus !== newRoom.status) {
                await this.syncRoomStatus(dto.newRoomId);
            }
            if (effectiveStatus === client_1.RoomStatus.MAINTENANCE) {
                throw new common_1.BadRequestException(`PhÃ²ng ${newRoom.roomNumber} Ä‘ang báº£o trÃ¬, khÃ´ng thá»ƒ chuyá»ƒn vÃ o`);
            }
            if (effectiveStatus === client_1.RoomStatus.PENDING_APPROVAL ||
                effectiveStatus === client_1.RoomStatus.REJECTED) {
                throw new common_1.BadRequestException(`PhÃ²ng ${newRoom.roomNumber} chÆ°a Ä‘Æ°á»£c duyá»‡t Ä‘Æ°a vÃ o khai thÃ¡c, khÃ´ng thá»ƒ chuyá»ƒn khÃ¡ch vÃ o`);
            }
            if (effectiveStatus === client_1.RoomStatus.CLEANING) {
                throw new common_1.BadRequestException(`PhÃ²ng ${newRoom.roomNumber} Ä‘ang Ä‘Æ°á»£c dá»n dáº¹p, vui lÃ²ng chá» buá»“ng phÃ²ng hoÃ n táº¥t`);
            }
            const conflictBooking = await this.prisma.booking.findFirst({
                where: {
                    id: { not: id },
                    roomId: dto.newRoomId,
                    status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
                    checkInDate: { lt: booking.checkOutDate },
                    checkOutDate: { gt: now },
                },
                orderBy: { checkInDate: 'asc' },
            });
            if (conflictBooking) {
                throw new common_1.ConflictException(conflictBooking.status === client_1.BookingStatus.CHECKED_IN
                    ? `PhÃ²ng ${newRoom.roomNumber} Ä‘ang cÃ³ khÃ¡ch lÆ°u trÃº, khÃ´ng thá»ƒ chuyá»ƒn vÃ o`
                    : `PhÃ²ng ${newRoom.roomNumber} Ä‘Ã£ cÃ³ lá»‹ch Ä‘áº·t tá»« ${new Date(conflictBooking.checkInDate).toLocaleString('vi-VN')} trong khoáº£ng lÆ°u trÃº cÃ²n láº¡i`);
            }
            let newTotalAmount = booking.totalAmount;
            if (dto.keepPrice === false) {
                const remainingNights = Math.max(1, Math.ceil((new Date(booking.checkOutDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                const totalNights = Math.max(1, Math.ceil((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
                const passedNights = Math.max(0, totalNights - remainingNights);
                const oldBasePrice = booking.room.roomType.basePrice;
                const newBasePrice = newRoom.roomType.basePrice;
                newTotalAmount = (0, revenue_util_1.roundMoney)((passedNights * oldBasePrice) + (remainingNights * newBasePrice));
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
                    data: { status: client_1.RoomStatus.CLEANING },
                }),
                this.prisma.room.update({
                    where: { id: dto.newRoomId },
                    data: { status: client_1.RoomStatus.OCCUPIED },
                }),
            ]);
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
                status: client_1.RoomStatus.CLEANING,
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
                status: client_1.RoomStatus.OCCUPIED,
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
        }
        finally {
            await this.redis.releaseLock(lockKey, lockToken);
        }
    }
    async requestServiceOrder(id, dto, customerId) {
        const booking = await this.findOne(id);
        if (booking.customerId !== customerId) {
            throw new common_1.ForbiddenException('Báº¡n chá»‰ cÃ³ thá»ƒ yÃªu cáº§u dá»‹ch vá»¥ cho Ä‘Æ¡n Ä‘áº·t phÃ²ng cá»§a chÃ­nh mÃ¬nh');
        }
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Chá»‰ cÃ³ thá»ƒ gá»i dá»‹ch vá»¥ khi Ä‘ang nháº­n phÃ²ng lÆ°u trÃº (CHECKED_IN)');
        }
        const quantity = dto.quantity || 1;
        const totalPrice = (0, revenue_util_1.roundMoney)(dto.unitPrice * quantity);
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
    async updateServiceOrderStatus(bookingId, orderId, dto) {
        const order = await this.prisma.extraServiceOrder.findFirst({
            where: { id: orderId, bookingId },
        });
        if (!order) {
            throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y yÃªu cáº§u dá»‹ch vá»¥ vá»›i ID: ${orderId}`);
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
    async notifyCheckoutReminder(bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                room: { select: { roomNumber: true } },
                customer: { select: { id: true, fullName: true, fcmToken: true } },
            },
        });
        if (!booking) {
            throw new common_1.NotFoundException(`Không tìm thấy đơn đặt phòng #${bookingId}`);
        }
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException(`Đơn đặt phòng đang ở trạng thái ${booking.status}, chỉ có thể gửi nhắc nhở trả phòng cho khách đang lưu trú (CHECKED_IN).`);
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
    async notifyAllTodayCheckouts() {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        const todayBookings = await this.prisma.booking.findMany({
            where: {
                status: client_1.BookingStatus.CHECKED_IN,
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
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = BookingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        elasticsearch_service_1.ElasticsearchService,
        room_events_service_1.RoomEventsService,
        invoices_service_1.InvoicesService,
        notifications_service_1.NotificationsService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map