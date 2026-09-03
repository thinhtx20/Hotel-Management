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
let InvoicesService = class InvoicesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(status) {
        return this.prisma.invoice.findMany({
            where: status ? { paymentStatus: status } : undefined,
            include: {
                booking: {
                    include: {
                        customer: { select: { fullName: true, phone: true, email: true } },
                        room: { select: { roomNumber: true } },
                    },
                },
                issuedBy: { select: { fullName: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id) {
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
        return invoice;
    }
    async recordPayment(id, dto, cashierId) {
        const invoice = await this.findOne(id);
        const newPaidAmount = invoice.paidAmount + dto.amount;
        const isFullyPaid = newPaidAmount >= invoice.finalAmount;
        return this.prisma.invoice.update({
            where: { id },
            data: {
                paidAmount: newPaidAmount,
                paymentMethod: dto.paymentMethod,
                paymentStatus: isFullyPaid
                    ? client_1.PaymentStatus.PAID
                    : client_1.PaymentStatus.PARTIAL,
                notes: dto.notes ? `${invoice.notes || ''}\n${dto.notes}`.trim() : invoice.notes,
                issuedById: cashierId,
                paidAt: isFullyPaid ? new Date() : invoice.paidAt,
            },
        });
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map