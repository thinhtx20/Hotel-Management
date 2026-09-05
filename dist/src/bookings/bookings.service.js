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
const client_1 = require("@prisma/client");
const room_events_service_1 = require("../rooms/room-events.service");
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
    constructor(prisma, redis, esService, roomEvents) {
        this.prisma = prisma;
        this.redis = redis;
        this.esService = esService;
        this.roomEvents = roomEvents;
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
                    select: { status: true, checkOutDate: true },
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
            throw new common_1.BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
        }
        const checkIn = new Date(rawCheckIn);
        checkIn.setUTCHours(14, 0, 0, 0);
        const checkOut = new Date(rawCheckOut);
        checkOut.setUTCHours(12, 0, 0, 0);
        const lockKey = `lock:booking:room:${dto.roomId}`;
        const lockToken = await this.redis.acquireLock(lockKey, 6000);
        if (!lockToken) {
            this.logger.warn(`Conflict lock trên phòng ${dto.roomId} bởi request đồng thời`);
            throw new common_1.ConflictException('Phòng này đang được khách khác giữ chỗ để thanh toán, vui lòng thử lại sau giây lát!');
        }
        try {
            const room = await this.prisma.room.findUnique({
                where: { id: dto.roomId },
                include: { roomType: true },
            });
            if (!room) {
                throw new common_1.NotFoundException(`Không tìm thấy phòng với ID: ${dto.roomId}`);
            }
            if (room.status === client_1.RoomStatus.MAINTENANCE) {
                throw new common_1.BadRequestException('Phòng này hiện đang bảo trì, không thể đặt');
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
                throw new common_1.ConflictException('Phòng này đã có khách đặt hoặc đang ở trong khoảng thời gian được chọn');
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
        const isPaginated = query.page !== undefined || query.limit !== undefined;
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const [total, list] = await this.prisma.$transaction([
            this.prisma.booking.count({ where }),
            this.prisma.booking.findMany({
                where,
                include: BOOKING_INCLUDE,
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
    assertOwnership(booking, userId, userRole) {
        if (userRole === client_1.Role.CUSTOMER && booking.customerId !== userId) {
            throw new common_1.ForbiddenException('Bạn chỉ có thể xem và thao tác trên đơn đặt phòng của chính mình');
        }
    }
    async findOne(id, currentUserId, currentUserRole) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: BOOKING_INCLUDE,
        });
        if (!booking) {
            throw new common_1.NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
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
            throw new common_1.NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
        }
        if (booking.status === client_1.BookingStatus.CONFIRMED) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã được phê duyệt trước đó');
        }
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã bị hủy, không thể phê duyệt');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_IN || booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('Đơn đặt phòng đã hoặc đang được thực hiện, không thể duyệt lại');
        }
        const targetRoomId = dto?.assignedRoomId || booking.roomId;
        const targetRoom = await this.prisma.room.findUnique({ where: { id: targetRoomId } });
        if (!targetRoom) {
            throw new common_1.NotFoundException(`Không tìm thấy phòng cần xếp với ID: ${targetRoomId}`);
        }
        if (targetRoom.status === client_1.RoomStatus.MAINTENANCE) {
            throw new common_1.BadRequestException('Phòng được xếp đang bảo trì, không thể nhận khách');
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
                throw new common_1.ConflictException(`Phòng ${targetRoom.roomNumber} đã có đơn ${conflict.bookingCode} trùng lịch trong khoảng thời gian này`);
            }
        }
        const depositAmount = dto?.depositAmount !== undefined ? dto.depositAmount : (booking.depositAmount || 0);
        const invoiceCode = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
        const ops = [
            this.prisma.booking.update({
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
            }),
        ];
        if (depositAmount > 0) {
            const isPaid = depositAmount >= booking.totalAmount;
            ops.push(this.prisma.invoice.upsert({
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
                    paymentMethod: dto?.paymentMethod || client_1.PaymentMethod.BANK_TRANSFER,
                    paymentStatus: isPaid ? client_1.PaymentStatus.PAID : client_1.PaymentStatus.PARTIAL,
                    notes: dto?.notes || 'Tiền cọc giữ chỗ khi duyệt phòng',
                    issuedById: currentUserId,
                    paidAt: new Date(),
                },
                update: {
                    paidAmount: depositAmount,
                    paymentStatus: isPaid ? client_1.PaymentStatus.PAID : client_1.PaymentStatus.PARTIAL,
                    paymentMethod: dto?.paymentMethod || client_1.PaymentMethod.BANK_TRANSFER,
                    notes: dto?.notes || 'Tiền cọc giữ chỗ khi duyệt phòng',
                    issuedById: currentUserId,
                    paidAt: new Date(),
                },
            }));
        }
        const results = await this.prisma.$transaction(ops);
        const updatedBooking = results[0];
        const invoice = results[1] || updatedBooking.invoice;
        const targetRoomStatus = (await this.syncRoomStatus(targetRoomId)) ?? targetRoom.status;
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
    async confirm(id, dto, currentUserId) {
        const result = await this.approve(id, dto, currentUserId);
        return {
            ...result,
            message: 'Xác nhận đơn đặt phòng thành công',
        };
    }
    async reject(id, dto, currentUserId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: BOOKING_INCLUDE,
        });
        if (!booking) {
            throw new common_1.NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
        }
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã bị hủy trước đó');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_IN || booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('Không thể từ chối đơn đặt phòng đã hoặc đang lưu trú');
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
        return {
            message: 'Từ chối đơn đặt phòng thành công',
            booking: this.toBookingResponse(updatedBooking),
        };
    }
    async checkIn(id) {
        const booking = await this.findOne(id);
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã bị hủy');
        }
        if (booking.status === client_1.BookingStatus.PENDING) {
            throw new common_1.BadRequestException('Đơn đặt phòng đang ở trạng thái chờ duyệt. Lễ tân vui lòng phê duyệt đơn trước khi thực hiện check-in');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Khách đã check-in trước đó');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã hoàn tất check-out');
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
        return this.toBookingResponse(updatedBooking);
    }
    async checkOut(id, dto, cashierId) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Chỉ có thể check-out đơn đặt phòng đang ở trạng thái CHECKED_IN');
        }
        const servicesTotal = booking.serviceOrders
            .filter((s) => s.status === 'CONFIRMED' || !s.status)
            .reduce((sum, s) => sum + s.totalPrice, 0);
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
                    status: client_1.BookingStatus.CHECKED_OUT,
                    actualCheckOut: new Date(),
                },
                include: BOOKING_INCLUDE,
            }),
            this.prisma.room.update({
                where: { id: booking.roomId },
                data: { status: client_1.RoomStatus.CLEANING },
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
                    paymentMethod: dto.paymentMethod || client_1.PaymentMethod.CASH,
                    paymentStatus: client_1.PaymentStatus.PAID,
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
                    paymentMethod: dto.paymentMethod || client_1.PaymentMethod.CASH,
                    paymentStatus: client_1.PaymentStatus.PAID,
                    issuedById: cashierId,
                    paidAt: new Date(),
                },
            }),
        ]);
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
        return {
            message: 'Check-out và thanh toán hóa đơn thành công',
            invoiceId: invoice.id,
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
            throw new common_1.BadRequestException('Khách đang ở phòng, không thể hủy đơn đặt');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('Đơn đặt phòng đã hoàn tất, không thể hủy');
        }
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã bị hủy trước đó');
        }
        if (currentUserRole === client_1.Role.CUSTOMER && booking.status !== client_1.BookingStatus.PENDING) {
            throw new common_1.ForbiddenException('Đơn đặt phòng đã được lễ tân xác nhận nên không thể tự hủy. ' +
                'Vui lòng liên hệ lễ tân để được hỗ trợ.');
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
            throw new common_1.BadRequestException('Chỉ có thể thêm dịch vụ cho khách đang lưu trú tại phòng');
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
            throw new common_1.BadRequestException('Chỉ có thể đổi phòng cho đơn đặt phòng đang lưu trú (CHECKED_IN)');
        }
        if (dto.newRoomId === booking.roomId) {
            throw new common_1.BadRequestException('Phòng mới phải khác phòng hiện tại đang ở');
        }
        const newRoom = await this.prisma.room.findUnique({
            where: { id: dto.newRoomId },
            include: { roomType: true },
        });
        if (!newRoom) {
            throw new common_1.NotFoundException(`Không tìm thấy phòng mới với ID: ${dto.newRoomId}`);
        }
        if (newRoom.status === client_1.RoomStatus.MAINTENANCE) {
            throw new common_1.BadRequestException('Phòng mới hiện đang bảo trì, không thể chuyển vào');
        }
        if (newRoom.status !== client_1.RoomStatus.AVAILABLE) {
            throw new common_1.BadRequestException(`Phòng mới hiện không khả dụng (Trạng thái: ${newRoom.status})`);
        }
        const lockKey = `lock:room:${dto.newRoomId}`;
        const lockToken = await this.redis.acquireLock(lockKey, 5000);
        if (!lockToken) {
            throw new common_1.ConflictException('Phòng mới đang được xử lý bởi một thao tác khác, vui lòng thử lại');
        }
        try {
            const now = new Date();
            const conflictBooking = await this.prisma.booking.findFirst({
                where: {
                    roomId: dto.newRoomId,
                    status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
                    checkOutDate: { gt: now },
                    AND: [
                        { checkInDate: { lt: booking.checkOutDate } },
                        { checkOutDate: { gt: now } },
                    ],
                },
            });
            if (conflictBooking) {
                throw new common_1.ConflictException('Phòng mới đã có lịch đặt trong khoảng thời gian lưu trú còn lại');
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
            const note = `[Đổi phòng: từ ${booking.room.roomNumber} sang ${newRoom.roomNumber} lúc ${new Date().toLocaleString('vi-VN')}. Lý do: ${dto.reason}]`;
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
                previousStatus: newRoom.status,
                roomTypeId: newRoom.roomTypeId,
                roomTypeName: newRoom.roomType?.name,
                roomTypeCode: newRoom.roomType?.code,
                pricePerNight: newRoom.roomType?.basePrice,
                notes: newRoom.notes,
                updatedAt: new Date().toISOString(),
            });
            return {
                message: 'Đổi phòng thành công',
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
            throw new common_1.ForbiddenException('Bạn chỉ có thể yêu cầu dịch vụ cho đơn đặt phòng của chính mình');
        }
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Chỉ có thể gọi dịch vụ khi đang nhận phòng lưu trú (CHECKED_IN)');
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
            throw new common_1.NotFoundException(`Không tìm thấy yêu cầu dịch vụ với ID: ${orderId}`);
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
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = BookingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        elasticsearch_service_1.ElasticsearchService,
        room_events_service_1.RoomEventsService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map