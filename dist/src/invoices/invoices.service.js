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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const revenue_util_1 = require("../common/utils/revenue.util");
let InvoicesService = class InvoicesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toInvoiceResponse(invoice) {
        const customer = invoice.booking?.customer;
        const room = invoice.booking?.room;
        const serviceOrders = invoice.booking?.serviceOrders || [];
        const items = [];
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
        const payments = [];
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
    async findAll(status) {
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
    async findMyInvoices(customerId, status) {
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
    async findOne(id, currentUserId, currentUserRole) {
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
            throw new common_1.NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
        }
        if (currentUserRole === client_1.Role.CUSTOMER &&
            invoice.booking?.customerId !== currentUserId) {
            throw new common_1.ForbiddenException('Bạn chỉ có thể xem hóa đơn thuộc đơn đặt phòng của chính mình');
        }
        return this.toInvoiceResponse(invoice);
    }
    async recordPayment(id, dto, cashierId) {
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
            throw new common_1.NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
        }
        const newPaidAmount = invoice.paidAmount + dto.amount;
        const isFullyPaid = newPaidAmount >= invoice.finalAmount;
        const updated = await this.prisma.invoice.update({
            where: { id },
            data: {
                paidAmount: newPaidAmount,
                paymentMethod: dto.paymentMethod,
                paymentStatus: isFullyPaid
                    ? client_1.PaymentStatus.PAID
                    : client_1.PaymentStatus.PARTIAL,
                notes: dto.notes ? `${invoice.notes || ''}\n${dto.notes}`.trim() : invoice.notes,
                issuedById: cashierId,
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
    async create(dto, cashierId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: dto.bookingId },
            include: { serviceOrders: true, invoice: true },
        });
        if (!booking) {
            throw new common_1.NotFoundException(`Không tìm thấy đơn đặt phòng ID: ${dto.bookingId}`);
        }
        if (booking.invoice) {
            throw new common_1.BadRequestException('Đơn đặt phòng này đã tồn tại hóa đơn');
        }
        const servicesTotal = booking.serviceOrders.reduce((sum, s) => sum + s.totalPrice, 0);
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
                paymentMethod: dto.paymentMethod || client_1.PaymentMethod.CASH,
                paymentStatus: client_1.PaymentStatus.UNPAID,
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
    async getSummary(dateQuery) {
        let targetDate = new Date();
        if (dateQuery && dateQuery !== 'today') {
            const parsed = new Date(dateQuery);
            if (!isNaN(parsed.getTime())) {
                targetDate = parsed;
            }
        }
        const dayStart = (0, revenue_util_1.startOfDay)(targetDate);
        const dayEnd = (0, revenue_util_1.endOfDay)(targetDate);
        const [revenueTodayAgg, totalInvoices, paidInvoices, unpaidInvoices, partialInvoices,] = await Promise.all([
            this.prisma.invoice.aggregate({
                _sum: { paidAmount: true },
                where: (0, revenue_util_1.collectedRevenueWhere)(dayStart, dayEnd),
            }),
            this.prisma.invoice.count({
                where: {
                    createdAt: { gte: dayStart, lte: dayEnd },
                },
            }),
            this.prisma.invoice.count({
                where: {
                    paymentStatus: client_1.PaymentStatus.PAID,
                    paidAt: { gte: dayStart, lte: dayEnd },
                },
            }),
            this.prisma.invoice.count({
                where: {
                    paymentStatus: client_1.PaymentStatus.UNPAID,
                },
            }),
            this.prisma.invoice.count({
                where: {
                    paymentStatus: client_1.PaymentStatus.PARTIAL,
                },
            }),
        ]);
        const todayRevenue = (0, revenue_util_1.roundMoney)(revenueTodayAgg._sum.paidAmount || 0);
        return {
            date: (0, revenue_util_1.formatLocalDate)(dayStart),
            todayRevenue,
            totalInvoices,
            paidInvoices,
            unpaidInvoices,
            partialInvoices,
        };
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map