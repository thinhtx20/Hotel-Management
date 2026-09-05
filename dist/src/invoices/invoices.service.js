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
const pagination_util_1 = require("../common/utils/pagination.util");
const client_1 = require("@prisma/client");
const revenue_util_1 = require("../common/utils/revenue.util");
const INVOICE_INCLUDE = {
    booking: {
        include: {
            customer: { select: { id: true, fullName: true, phone: true, email: true } },
            room: { select: { roomNumber: true } },
            serviceOrders: true,
        },
    },
    issuedBy: { select: { fullName: true, email: true, role: true } },
    payments: {
        include: {
            createdBy: { select: { id: true, fullName: true, role: true } },
            confirmedBy: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: 'asc' },
    },
};
let InvoicesService = class InvoicesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async recalculateInvoiceTotals(tx, invoiceId) {
        const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            select: { finalAmount: true, paymentMethod: true },
        });
        if (!invoice) {
            throw new common_1.NotFoundException(`Không tìm thấy hóa đơn ID: ${invoiceId}`);
        }
        const entries = await tx.payment.findMany({
            where: { invoiceId, status: client_1.PaymentEntryStatus.CONFIRMED },
            orderBy: { confirmedAt: 'asc' },
        });
        let collected = 0;
        let refunded = 0;
        let lastPaidAt = null;
        let lastMethod = invoice.paymentMethod;
        for (const entry of entries) {
            if (entry.type === client_1.PaymentEntryType.REFUND) {
                refunded += entry.amount;
            }
            else {
                collected += entry.amount;
                lastMethod = entry.method;
            }
            const stamp = entry.confirmedAt ?? entry.createdAt;
            if (!lastPaidAt || stamp > lastPaidAt) {
                lastPaidAt = stamp;
            }
        }
        const paidAmount = (0, revenue_util_1.roundMoney)(collected - refunded);
        let paymentStatus;
        if (paidAmount <= 0) {
            paymentStatus = refunded > 0 ? client_1.PaymentStatus.REFUNDED : client_1.PaymentStatus.UNPAID;
        }
        else if (paidAmount >= (0, revenue_util_1.roundMoney)(invoice.finalAmount)) {
            paymentStatus = client_1.PaymentStatus.PAID;
        }
        else {
            paymentStatus = client_1.PaymentStatus.PARTIAL;
        }
        return tx.invoice.update({
            where: { id: invoiceId },
            data: {
                paidAmount,
                paymentStatus,
                paymentMethod: lastMethod,
                paidAt: paidAmount > 0 ? lastPaidAt : null,
            },
            include: INVOICE_INCLUDE,
        });
    }
    toInvoiceResponse(invoice) {
        const customer = invoice.booking?.customer;
        const room = invoice.booking?.room;
        const serviceOrders = invoice.booking?.serviceOrders || [];
        const ledger = invoice.payments || [];
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
        const payments = ledger
            .filter((p) => p.status === client_1.PaymentEntryStatus.CONFIRMED)
            .map((p) => ({
            id: p.id,
            amount: p.type === client_1.PaymentEntryType.REFUND ? -p.amount : p.amount,
            type: p.type,
            paymentMethod: p.method,
            paidAt: p.confirmedAt ?? p.createdAt,
            reference: p.reference,
            note: p.note,
            cashierName: p.confirmedBy?.fullName || invoice.issuedBy?.fullName || 'Thu ngân ca trực',
        }));
        const pendingPayments = ledger
            .filter((p) => p.status === client_1.PaymentEntryStatus.PENDING)
            .map((p) => ({
            id: p.id,
            amount: p.amount,
            paymentMethod: p.method,
            reference: p.reference,
            note: p.note,
            requestedAt: p.createdAt,
            requestedByName: p.createdBy?.fullName || customer?.fullName || null,
        }));
        const finalAmount = (0, revenue_util_1.roundMoney)(invoice.finalAmount);
        const paidAmount = (0, revenue_util_1.roundMoney)(invoice.paidAmount);
        const remainingAmount = Math.max(0, finalAmount - paidAmount);
        const pendingAmount = (0, revenue_util_1.roundMoney)(pendingPayments.reduce((sum, p) => sum + p.amount, 0));
        return {
            ...invoice,
            payments,
            pendingPayments,
            roomNumber: room?.roomNumber || 'N/A',
            customerName: customer?.fullName || 'Khách vãng lai',
            customerPhone: customer?.phone || null,
            items,
            depositAmount: (0, revenue_util_1.roundMoney)(invoice.booking?.depositAmount || 0),
            remainingAmount,
            pendingAmount,
            hasPendingPaymentRequest: pendingPayments.length > 0,
            canRequestPayment: remainingAmount > 0 && pendingPayments.length === 0,
        };
    }
    async findAll(queryOrStatus) {
        const query = typeof queryOrStatus === 'string'
            ? { status: queryOrStatus }
            : (queryOrStatus ?? {});
        const where = {};
        if (query.status) {
            where.paymentStatus = query.status;
        }
        if (query.search) {
            const search = query.search.trim();
            const insensitive = 'insensitive';
            where.OR = [
                { invoiceCode: { contains: search, mode: insensitive } },
                { booking: { customer: { fullName: { contains: search, mode: insensitive } } } },
                { booking: { customer: { phone: { contains: search, mode: insensitive } } } },
                { booking: { customer: { email: { contains: search, mode: insensitive } } } },
                { booking: { room: { roomNumber: { contains: search, mode: insensitive } } } },
            ];
        }
        const { isPaginated, page, limit, skip, take } = (0, pagination_util_1.calculatePagination)(query);
        const [total, list] = await this.prisma.$transaction([
            this.prisma.invoice.count({ where }),
            this.prisma.invoice.findMany({
                where,
                include: INVOICE_INCLUDE,
                orderBy: { createdAt: 'desc' },
                ...(isPaginated ? { skip, take } : {}),
            }),
        ]);
        const data = list.map((inv) => this.toInvoiceResponse(inv));
        return (0, pagination_util_1.buildPaginatedResult)(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
    }
    async findMyInvoices(customerId, queryOrStatus) {
        const query = typeof queryOrStatus === 'string'
            ? { status: queryOrStatus }
            : (queryOrStatus ?? {});
        const where = {
            booking: { customerId },
            ...(query.status ? { paymentStatus: query.status } : {}),
        };
        if (query.search) {
            const search = query.search.trim();
            const insensitive = 'insensitive';
            where.OR = [
                { invoiceCode: { contains: search, mode: insensitive } },
                { booking: { room: { roomNumber: { contains: search, mode: insensitive } } } },
            ];
        }
        const { isPaginated, page, limit, skip, take } = (0, pagination_util_1.calculatePagination)(query);
        const [total, list] = await this.prisma.$transaction([
            this.prisma.invoice.count({ where }),
            this.prisma.invoice.findMany({
                where,
                include: INVOICE_INCLUDE,
                orderBy: { createdAt: 'desc' },
                ...(isPaginated ? { skip, take } : {}),
            }),
        ]);
        const data = list.map((inv) => this.toInvoiceResponse(inv));
        return (0, pagination_util_1.buildPaginatedResult)(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
    }
    async findOne(id, currentUserId, currentUserRole) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            include: INVOICE_INCLUDE,
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
            select: { id: true, finalAmount: true, paidAmount: true, paymentStatus: true },
        });
        if (!invoice) {
            throw new common_1.NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
        }
        if (dto.amount <= 0) {
            throw new common_1.BadRequestException('Số tiền thu phải lớn hơn 0');
        }
        const remaining = Math.max(0, (0, revenue_util_1.roundMoney)(invoice.finalAmount) - (0, revenue_util_1.roundMoney)(invoice.paidAmount));
        if (remaining <= 0) {
            throw new common_1.BadRequestException('Hóa đơn này đã được thanh toán đủ toàn bộ');
        }
        if ((0, revenue_util_1.roundMoney)(dto.amount) > remaining) {
            throw new common_1.BadRequestException(`Số tiền thu (${dto.amount.toLocaleString('vi-VN')}đ) vượt quá số còn phải thu ` +
                `(${remaining.toLocaleString('vi-VN')}đ). Nếu khách trả dư, hãy thu đúng số còn lại và trả lại tiền thừa.`);
        }
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.payment.create({
                data: {
                    invoiceId: id,
                    amount: (0, revenue_util_1.roundMoney)(dto.amount),
                    method: dto.paymentMethod,
                    type: client_1.PaymentEntryType.PAYMENT,
                    status: client_1.PaymentEntryStatus.CONFIRMED,
                    note: dto.notes,
                    createdById: cashierId,
                    confirmedById: cashierId,
                    confirmedAt: now,
                },
            });
            if (dto.notes) {
                const current = await tx.invoice.findUnique({
                    where: { id },
                    select: { notes: true },
                });
                await tx.invoice.update({
                    where: { id },
                    data: {
                        notes: `${current?.notes || ''}\n${dto.notes}`.trim(),
                        issuedById: cashierId,
                    },
                });
            }
            else {
                await tx.invoice.update({ where: { id }, data: { issuedById: cashierId } });
            }
            return this.recalculateInvoiceTotals(tx, id);
        });
        return this.toInvoiceResponse(updated);
    }
    async createPaymentRequest(id, dto, userId, userRole) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            include: {
                booking: { select: { customerId: true } },
                payments: { where: { status: client_1.PaymentEntryStatus.PENDING } },
            },
        });
        if (!invoice) {
            throw new common_1.NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
        }
        if (userRole === client_1.Role.CUSTOMER && invoice.booking?.customerId !== userId) {
            throw new common_1.ForbiddenException('Bạn chỉ có thể thanh toán hóa đơn thuộc đơn đặt phòng của chính mình');
        }
        const remaining = Math.max(0, (0, revenue_util_1.roundMoney)(invoice.finalAmount) - (0, revenue_util_1.roundMoney)(invoice.paidAmount));
        if (remaining <= 0) {
            throw new common_1.BadRequestException('Hóa đơn này đã được thanh toán đủ, không cần trả thêm');
        }
        if (invoice.payments.length > 0) {
            const pending = (0, revenue_util_1.roundMoney)(invoice.payments.reduce((sum, p) => sum + p.amount, 0));
            throw new common_1.BadRequestException(`Bạn đang có yêu cầu thanh toán ${pending.toLocaleString('vi-VN')}đ chờ lễ tân xác nhận. ` +
                'Vui lòng đợi lễ tân đối chiếu xong hoặc hủy yêu cầu cũ trước khi tạo yêu cầu mới.');
        }
        const amount = dto.amount !== undefined ? (0, revenue_util_1.roundMoney)(dto.amount) : remaining;
        if (amount > remaining) {
            throw new common_1.BadRequestException(`Số tiền thanh toán (${amount.toLocaleString('vi-VN')}đ) vượt quá số còn lại của hóa đơn ` +
                `(${remaining.toLocaleString('vi-VN')}đ)`);
        }
        const payment = await this.prisma.payment.create({
            data: {
                invoiceId: id,
                amount,
                method: dto.paymentMethod,
                type: client_1.PaymentEntryType.PAYMENT,
                status: client_1.PaymentEntryStatus.PENDING,
                reference: dto.reference,
                note: dto.note,
                createdById: userId,
            },
        });
        const refreshed = await this.prisma.invoice.findUnique({
            where: { id },
            include: INVOICE_INCLUDE,
        });
        return {
            message: amount >= remaining
                ? 'Đã gửi yêu cầu thanh toán toàn bộ số tiền còn lại. Lễ tân sẽ xác nhận sau khi đối chiếu.'
                : 'Đã gửi yêu cầu thanh toán. Lễ tân sẽ xác nhận sau khi đối chiếu.',
            paymentId: payment.id,
            amount,
            remainingAfterConfirm: Math.max(0, remaining - amount),
            invoice: this.toInvoiceResponse(refreshed),
        };
    }
    async cancelPaymentRequest(invoiceId, paymentId, userId, userRole) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { invoice: { include: { booking: { select: { customerId: true } } } } },
        });
        if (!payment || payment.invoiceId !== invoiceId) {
            throw new common_1.NotFoundException(`Không tìm thấy yêu cầu thanh toán ID: ${paymentId}`);
        }
        if (userRole === client_1.Role.CUSTOMER &&
            payment.invoice.booking?.customerId !== userId) {
            throw new common_1.ForbiddenException('Bạn chỉ có thể hủy yêu cầu thanh toán của chính mình');
        }
        if (payment.status !== client_1.PaymentEntryStatus.PENDING) {
            throw new common_1.BadRequestException('Chỉ hủy được yêu cầu đang chờ xác nhận. Yêu cầu đã được lễ tân xử lý thì phải liên hệ quầy lễ tân.');
        }
        await this.prisma.payment.delete({ where: { id: paymentId } });
        const refreshed = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: INVOICE_INCLUDE,
        });
        return {
            message: 'Đã hủy yêu cầu thanh toán',
            invoice: this.toInvoiceResponse(refreshed),
        };
    }
    async findPaymentRequests(queryOrStatus) {
        const query = typeof queryOrStatus === 'string'
            ? { status: queryOrStatus }
            : (queryOrStatus ?? {});
        const status = query.status;
        if (status && !Object.values(client_1.PaymentEntryStatus).includes(status)) {
            throw new common_1.BadRequestException(`Trạng thái "${status}" không hợp lệ. Chỉ nhận: ${Object.values(client_1.PaymentEntryStatus).join(', ')}`);
        }
        const where = {
            status: status ?? client_1.PaymentEntryStatus.PENDING,
        };
        if (query.search) {
            const search = query.search.trim();
            const insensitive = 'insensitive';
            where.OR = [
                { reference: { contains: search, mode: insensitive } },
                { invoice: { invoiceCode: { contains: search, mode: insensitive } } },
                { invoice: { booking: { customer: { fullName: { contains: search, mode: insensitive } } } } },
                { invoice: { booking: { customer: { phone: { contains: search, mode: insensitive } } } } },
                { invoice: { booking: { room: { roomNumber: { contains: search, mode: insensitive } } } } },
            ];
        }
        const { isPaginated, page, limit, skip, take } = (0, pagination_util_1.calculatePagination)(query);
        const [total, list] = await this.prisma.$transaction([
            this.prisma.payment.count({ where }),
            this.prisma.payment.findMany({
                where,
                include: {
                    createdBy: { select: { id: true, fullName: true, phone: true, role: true } },
                    confirmedBy: { select: { id: true, fullName: true } },
                    invoice: {
                        include: {
                            booking: {
                                include: {
                                    customer: { select: { fullName: true, phone: true } },
                                    room: { select: { roomNumber: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                ...(isPaginated ? { skip, take } : {}),
            }),
        ]);
        const data = list.map((p) => ({
            id: p.id,
            invoiceId: p.invoiceId,
            invoiceCode: p.invoice.invoiceCode,
            bookingCode: p.invoice.booking?.bookingCode,
            roomNumber: p.invoice.booking?.room?.roomNumber || 'N/A',
            customerName: p.invoice.booking?.customer?.fullName || p.createdBy?.fullName || 'Khách vãng lai',
            customerPhone: p.invoice.booking?.customer?.phone || p.createdBy?.phone || null,
            amount: p.amount,
            paymentMethod: p.method,
            status: p.status,
            reference: p.reference,
            note: p.note,
            requestedAt: p.createdAt,
            confirmedAt: p.confirmedAt,
            confirmedByName: p.confirmedBy?.fullName || null,
            rejectedReason: p.rejectedReason,
            invoiceFinalAmount: (0, revenue_util_1.roundMoney)(p.invoice.finalAmount),
            invoicePaidAmount: (0, revenue_util_1.roundMoney)(p.invoice.paidAmount),
            invoiceRemainingAmount: Math.max(0, (0, revenue_util_1.roundMoney)(p.invoice.finalAmount) - (0, revenue_util_1.roundMoney)(p.invoice.paidAmount)),
        }));
        return (0, pagination_util_1.buildPaginatedResult)(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
    }
    async confirmPayment(paymentId, dto, cashierId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { invoice: { select: { id: true, finalAmount: true, paidAmount: true } } },
        });
        if (!payment) {
            throw new common_1.NotFoundException(`Không tìm thấy yêu cầu thanh toán ID: ${paymentId}`);
        }
        if (payment.status !== client_1.PaymentEntryStatus.PENDING) {
            throw new common_1.BadRequestException(payment.status === client_1.PaymentEntryStatus.CONFIRMED
                ? 'Yêu cầu thanh toán này đã được xác nhận trước đó'
                : 'Yêu cầu thanh toán này đã bị từ chối, không thể xác nhận');
        }
        const amount = dto.amount !== undefined ? (0, revenue_util_1.roundMoney)(dto.amount) : payment.amount;
        if (amount <= 0) {
            throw new common_1.BadRequestException('Số tiền xác nhận phải lớn hơn 0');
        }
        const remaining = Math.max(0, (0, revenue_util_1.roundMoney)(payment.invoice.finalAmount) - (0, revenue_util_1.roundMoney)(payment.invoice.paidAmount));
        if (amount > remaining) {
            throw new common_1.BadRequestException(`Số tiền xác nhận (${amount.toLocaleString('vi-VN')}đ) vượt quá số còn phải thu của hóa đơn ` +
                `(${remaining.toLocaleString('vi-VN')}đ)`);
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: paymentId },
                data: {
                    amount,
                    method: dto.paymentMethod ?? payment.method,
                    status: client_1.PaymentEntryStatus.CONFIRMED,
                    confirmedById: cashierId,
                    confirmedAt: new Date(),
                    note: dto.note ? `${payment.note || ''}\n${dto.note}`.trim() : payment.note,
                },
            });
            await tx.invoice.update({
                where: { id: payment.invoiceId },
                data: { issuedById: cashierId },
            });
            return this.recalculateInvoiceTotals(tx, payment.invoiceId);
        });
        const response = this.toInvoiceResponse(updated);
        return {
            message: response.remainingAmount > 0
                ? `Đã xác nhận thu ${amount.toLocaleString('vi-VN')}đ. Hóa đơn còn thiếu ${response.remainingAmount.toLocaleString('vi-VN')}đ.`
                : `Đã xác nhận thu ${amount.toLocaleString('vi-VN')}đ. Hóa đơn đã thanh toán đủ.`,
            paymentId,
            amount,
            invoice: response,
        };
    }
    async rejectPayment(paymentId, dto, cashierId) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) {
            throw new common_1.NotFoundException(`Không tìm thấy yêu cầu thanh toán ID: ${paymentId}`);
        }
        if (payment.status !== client_1.PaymentEntryStatus.PENDING) {
            throw new common_1.BadRequestException('Chỉ từ chối được yêu cầu đang chờ xác nhận. Khoản đã thu muốn trả lại thì dùng chức năng hoàn tiền.');
        }
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: client_1.PaymentEntryStatus.REJECTED,
                rejectedReason: dto.reason,
                confirmedById: cashierId,
                confirmedAt: new Date(),
            },
        });
        const refreshed = await this.prisma.invoice.findUnique({
            where: { id: payment.invoiceId },
            include: INVOICE_INCLUDE,
        });
        return {
            message: 'Đã từ chối yêu cầu thanh toán',
            paymentId,
            reason: dto.reason,
            invoice: this.toInvoiceResponse(refreshed),
        };
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
            include: INVOICE_INCLUDE,
        });
        return this.toInvoiceResponse(newInvoice);
    }
    async getSummary(dateQuery, staffIdQuery, currentUserId) {
        let targetDate = new Date();
        if (dateQuery && dateQuery !== 'today') {
            const parsed = new Date(dateQuery);
            if (!isNaN(parsed.getTime())) {
                targetDate = parsed;
            }
        }
        const dayStart = (0, revenue_util_1.startOfDay)(targetDate);
        const dayEnd = (0, revenue_util_1.endOfDay)(targetDate);
        if (staffIdQuery) {
            const targetStaffId = staffIdQuery === 'me' ? currentUserId : staffIdQuery;
            let staffName = 'Nhân viên';
            if (targetStaffId) {
                const staffUser = await this.prisma.user.findUnique({
                    where: { id: targetStaffId },
                    select: { fullName: true },
                });
                if (staffUser) {
                    staffName = staffUser.fullName;
                }
            }
            const shiftEntries = await this.prisma.payment.findMany({
                where: {
                    confirmedById: targetStaffId,
                    status: client_1.PaymentEntryStatus.CONFIRMED,
                    confirmedAt: { gte: dayStart, lte: dayEnd },
                },
                select: { amount: true, method: true, type: true, invoiceId: true },
            });
            let amountCollected = 0;
            const byMethod = {
                CASH: 0,
                CREDIT_CARD: 0,
                BANK_TRANSFER: 0,
            };
            for (const entry of shiftEntries) {
                const signed = entry.type === client_1.PaymentEntryType.REFUND ? -entry.amount : entry.amount;
                amountCollected += signed;
                byMethod[entry.method] += signed;
            }
            const [invoicesIssued, unpaidLeftBehind, pendingRequests] = await Promise.all([
                this.prisma.invoice.count({
                    where: {
                        issuedById: targetStaffId,
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                }),
                this.prisma.invoice.count({
                    where: {
                        issuedById: targetStaffId,
                        createdAt: { gte: dayStart, lte: dayEnd },
                        paymentStatus: {
                            in: [client_1.PaymentStatus.UNPAID, client_1.PaymentStatus.PARTIAL],
                        },
                    },
                }),
                this.prisma.payment.count({ where: { status: client_1.PaymentEntryStatus.PENDING } }),
            ]);
            return {
                date: (0, revenue_util_1.formatLocalDate)(dayStart),
                staffId: targetStaffId,
                staffName,
                invoicesIssued,
                amountCollected: (0, revenue_util_1.roundMoney)(amountCollected),
                byMethod: {
                    CASH: (0, revenue_util_1.roundMoney)(byMethod.CASH),
                    CREDIT_CARD: (0, revenue_util_1.roundMoney)(byMethod.CREDIT_CARD),
                    BANK_TRANSFER: (0, revenue_util_1.roundMoney)(byMethod.BANK_TRANSFER),
                },
                unpaidLeftBehind,
                pendingPaymentRequests: pendingRequests,
            };
        }
        const [revenueTodayAgg, totalInvoices, paidInvoices, unpaidInvoices, partialInvoices, pendingPaymentRequests, outstandingAgg,] = await Promise.all([
            this.prisma.invoice.aggregate({
                _sum: { paidAmount: true },
                where: (0, revenue_util_1.collectedRevenueWhere)(dayStart, dayEnd),
            }),
            this.prisma.invoice.count({
                where: {
                    OR: [
                        { createdAt: { gte: dayStart, lte: dayEnd } },
                        { paidAt: { gte: dayStart, lte: dayEnd } },
                    ],
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
            this.prisma.payment.count({ where: { status: client_1.PaymentEntryStatus.PENDING } }),
            this.prisma.invoice.aggregate({
                _sum: { finalAmount: true, paidAmount: true },
                where: {
                    paymentStatus: { in: [client_1.PaymentStatus.UNPAID, client_1.PaymentStatus.PARTIAL] },
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
            pendingPaymentRequests,
            outstandingAmount: Math.max(0, (0, revenue_util_1.roundMoney)((outstandingAgg._sum.finalAmount || 0) - (outstandingAgg._sum.paidAmount || 0))),
        };
    }
    async refund(id, dto, staffId) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            select: { id: true, paidAmount: true, notes: true },
        });
        if (!invoice) {
            throw new common_1.NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
        }
        if (invoice.paidAmount <= 0) {
            throw new common_1.BadRequestException('Hóa đơn chưa thu tiền hoặc đã hoàn tiền toàn bộ, không thể hoàn thêm');
        }
        if (dto.amount > invoice.paidAmount) {
            throw new common_1.BadRequestException(`Số tiền hoàn (${dto.amount.toLocaleString()}đ) không được vượt quá số tiền đã thu (${invoice.paidAmount.toLocaleString()}đ)`);
        }
        const refundNote = `[Hoàn tiền: ${dto.amount.toLocaleString()}đ lúc ${new Date().toLocaleString('vi-VN')}. Lý do: ${dto.reason}]`;
        const updatedNotes = invoice.notes ? `${invoice.notes}\n${refundNote}` : refundNote;
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.payment.create({
                data: {
                    invoiceId: id,
                    amount: (0, revenue_util_1.roundMoney)(dto.amount),
                    method: dto.paymentMethod ?? client_1.PaymentMethod.CASH,
                    type: client_1.PaymentEntryType.REFUND,
                    status: client_1.PaymentEntryStatus.CONFIRMED,
                    note: `Hoàn tiền. Lý do: ${dto.reason}`,
                    createdById: staffId,
                    confirmedById: staffId,
                    confirmedAt: new Date(),
                },
            });
            await tx.invoice.update({
                where: { id },
                data: { notes: updatedNotes, issuedById: staffId },
            });
            return this.recalculateInvoiceTotals(tx, id);
        });
        return this.toInvoiceResponse(updated);
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map