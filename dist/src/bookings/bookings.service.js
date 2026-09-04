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
const room_status_util_1 = require("../common/utils/room-status.util");
const client_1 = require("@prisma/client");
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
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
        this.logger = new common_1.Logger(BookingsService_1.name);
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
        await this.prisma.room.update({
            where: { id: roomId },
            data: { status: nextStatus },
        });
        return nextStatus;
    }
    async create(dto, currentUserId, currentUserRole) {
        const checkIn = new Date(dto.checkInDate);
        const checkOut = new Date(dto.checkOutDate);
        if (checkIn >= checkOut) {
            throw new common_1.BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
        }
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
            const conflictBooking = await this.prisma.booking.findFirst({
                where: {
                    roomId: dto.roomId,
                    status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
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
            return this.toBookingResponse(booking);
        }
        finally {
            await this.redis.releaseLock(lockKey, lockToken);
        }
    }
    toBookingResponse(b) {
        const checkIn = new Date(b.checkInDate);
        const checkOut = new Date(b.checkOutDate);
        const diff = Math.abs(checkOut.getTime() - checkIn.getTime());
        const nights = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        const paymentStatus = b.invoice?.paymentStatus || (b.depositAmount > 0 ? 'PARTIAL' : 'UNPAID');
        const invoiceId = b.invoice?.id || null;
        const canCancel = b.status === client_1.BookingStatus.PENDING || b.status === client_1.BookingStatus.CONFIRMED;
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
    async findAll(query = {}) {
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
        const data = list.map((b) => this.toBookingResponse(b));
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
        return this.toBookingResponse(booking);
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
        if (targetRoomId !== booking.roomId) {
            const newRoom = await this.prisma.room.findUnique({ where: { id: targetRoomId } });
            if (!newRoom) {
                throw new common_1.NotFoundException(`Không tìm thấy phòng cần xếp với ID: ${targetRoomId}`);
            }
            if (newRoom.status === client_1.RoomStatus.MAINTENANCE) {
                throw new common_1.BadRequestException('Phòng được xếp đang bảo trì, không thể nhận khách');
            }
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
                throw new common_1.ConflictException(`Phòng ${newRoom.roomNumber} đã có đơn ${conflict.bookingCode} trùng lịch trong khoảng thời gian này`);
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
            this.prisma.room.update({
                where: { id: targetRoomId },
                data: { status: client_1.RoomStatus.RESERVED },
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
        const invoice = results[2] || updatedBooking.invoice;
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
                    status: client_1.RoomStatus.RESERVED,
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
        await this.redis.delByPattern('cache:rooms:*');
        return this.toBookingResponse(updatedBooking);
    }
    async checkOut(id, dto, cashierId) {
        const booking = await this.findOne(id);
        if (booking.status !== client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Chỉ có thể check-out đơn đặt phòng đang ở trạng thái CHECKED_IN');
        }
        const servicesTotal = booking.serviceOrders.reduce((sum, s) => sum + s.totalPrice, 0);
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
        await this.redis.delByPattern('cache:rooms:*');
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
        return this.toBookingResponse(updatedBooking);
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
            },
        });
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = BookingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map