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
const client_1 = require("@prisma/client");
let BookingsService = BookingsService_1 = class BookingsService {
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
        this.logger = new common_1.Logger(BookingsService_1.name);
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
                    status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
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
                    status: client_1.BookingStatus.CONFIRMED,
                    specialRequests: dto.specialRequests,
                },
                include: {
                    room: { include: { roomType: true } },
                    customer: { select: { id: true, fullName: true, email: true, phone: true } },
                },
            });
            await this.redis.delByPattern('cache:rooms:*');
            return booking;
        }
        finally {
            await this.redis.releaseLock(lockKey, lockToken);
        }
    }
    async findAll(status, customerId, roomId) {
        return this.prisma.booking.findMany({
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
    }
    async findOne(id) {
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
            throw new common_1.NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${id}`);
        }
        return booking;
    }
    async checkIn(id) {
        const booking = await this.findOne(id);
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã bị hủy');
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
                include: { room: true },
            }),
            this.prisma.room.update({
                where: { id: booking.roomId },
                data: { status: client_1.RoomStatus.OCCUPIED },
            }),
        ]);
        await this.redis.delByPattern('cache:rooms:*');
        return updatedBooking;
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
            booking: updatedBooking,
            invoice,
        };
    }
    async cancel(id) {
        const booking = await this.findOne(id);
        if (booking.status === client_1.BookingStatus.CHECKED_IN) {
            throw new common_1.BadRequestException('Khách đang ở phòng, không thể hủy đơn đặt');
        }
        if (booking.status === client_1.BookingStatus.CHECKED_OUT) {
            throw new common_1.BadRequestException('Đơn đặt phòng đã hoàn tất, không thể hủy');
        }
        const [updatedBooking] = await this.prisma.$transaction([
            this.prisma.booking.update({
                where: { id },
                data: { status: client_1.BookingStatus.CANCELLED },
            }),
            this.prisma.room.update({
                where: { id: booking.roomId },
                data: { status: client_1.RoomStatus.AVAILABLE },
            }),
        ]);
        await this.redis.delByPattern('cache:rooms:*');
        return updatedBooking;
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