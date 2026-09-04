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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const invoices_service_1 = require("./invoices.service");
const record_payment_dto_1 = require("./dto/record-payment.dto");
const create_invoice_dto_1 = require("./dto/create-invoice.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
const client_1 = require("@prisma/client");
const SAMPLE_INVOICE = {
    id: 'a9b8c7d6-e5f4-3210-fedc-ba9876543210',
    invoiceCode: 'INV-2026-0089',
    bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
    roomAmount: 3600000,
    servicesAmount: 200000,
    discount: 0,
    tax: 0,
    finalAmount: 3800000,
    paidAmount: 3800000,
    paymentMethod: 'CREDIT_CARD',
    paymentStatus: 'PAID',
    paidAt: '2026-09-03T07:00:00.000Z',
    issuedById: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    roomNumber: '101',
    customerName: 'Nguyễn Văn Khách Hàng',
    customerPhone: '0912345678',
    items: [
        { name: 'Tiền thuê phòng P.101', quantity: 1, unitPrice: 3600000, amount: 3600000 },
        { name: 'Minibar trọn gói', quantity: 1, unitPrice: 200000, amount: 200000 },
    ],
    payments: [
        { amount: 3800000, paymentMethod: 'CREDIT_CARD', paidAt: '2026-09-03T07:00:00.000Z', cashierName: 'Lê Thu Ngân' },
    ],
    booking: {
        bookingCode: 'BK-2026-0829',
        customer: {
            fullName: 'Nguyễn Văn Khách Hàng',
            phone: '0912345678',
        },
        room: {
            roomNumber: '101',
        },
    },
};
let InvoicesController = class InvoicesController {
    constructor(invoicesService) {
        this.invoicesService = invoicesService;
    }
    getSummary(date) {
        return this.invoicesService.getSummary(date);
    }
    findMine(userId, status) {
        return this.invoicesService.findMyInvoices(userId, status);
    }
    create(dto, cashierId) {
        return this.invoicesService.create(dto, cashierId);
    }
    findAll(status) {
        return this.invoicesService.findAll(status);
    }
    findOne(id, userId, userRole) {
        return this.invoicesService.findOne(id, userId, userRole);
    }
    recordPayment(id, dto, cashierId) {
        return this.invoicesService.recordPayment(id, dto, cashierId);
    }
};
exports.InvoicesController = InvoicesController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CASHIER),
    (0, swagger_1.ApiOperation)({ summary: 'Tổng quan doanh thu hôm nay và số lượng hóa đơn cho thu ngân' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: false, description: 'today hoặc ngày theo định dạng YYYY-MM-DD' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy tóm tắt doanh thu thành công',
        exampleData: {
            date: '2026-09-03',
            todayRevenue: 128500000,
            totalInvoices: 18,
            paidInvoices: 14,
            unpaidInvoices: 3,
            partialInvoices: 1,
        },
    }),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('my'),
    (0, swagger_1.ApiOperation)({
        summary: 'Hóa đơn của chính tôi (màn "Hóa đơn của tôi" bên app khách hàng)',
        description: 'Chỉ trả về hóa đơn thuộc các đơn đặt phòng của tài khoản đang đăng nhập. ' +
            'Nhân viên gọi endpoint này cũng chỉ thấy hóa đơn gắn với tài khoản của chính họ — ' +
            'muốn xem toàn bộ hóa đơn khách sạn thì dùng GET /invoices.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: client_1.PaymentStatus, required: false }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách hóa đơn của tài khoản hiện tại thành công',
        exampleData: [SAMPLE_INVOICE],
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "findMine", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CASHIER),
    (0, swagger_1.ApiOperation)({ summary: 'Tạo hóa đơn thủ công cho đơn đặt phòng' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Tạo hóa đơn thành công',
        exampleData: SAMPLE_INVOICE,
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_invoice_dto_1.CreateInvoiceDto, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CASHIER),
    (0, swagger_1.ApiOperation)({ summary: 'Lấy danh sách hóa đơn theo trạng thái thanh toán' }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: client_1.PaymentStatus, required: false }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách hóa đơn thành công',
        exampleData: [SAMPLE_INVOICE],
    }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CASHIER, client_1.Role.CUSTOMER),
    (0, swagger_1.ApiOperation)({
        summary: 'Xem chi tiết hóa đơn, tiền phòng và bảng kê dịch vụ phụ trợ',
        description: 'Nhân viên xem được mọi hóa đơn. Khách hàng chỉ mở được hóa đơn thuộc đơn đặt phòng ' +
            'của chính mình, sai chủ sở hữu sẽ nhận 403.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xem chi tiết hóa đơn thành công',
        exampleData: SAMPLE_INVOICE,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'Không tìm thấy hóa đơn với ID tương ứng',
        error: 'Not Found',
        path: '/api/v1/invoices/:id',
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 403,
        message: 'Bạn chỉ có thể xem hóa đơn thuộc đơn đặt phòng của chính mình',
        error: 'Forbidden',
        path: '/api/v1/invoices/:id',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/pay'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CASHIER),
    (0, swagger_1.ApiOperation)({ summary: 'Ghi nhận thanh toán hóa đơn (Thu ngân / Kế toán)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Ghi nhận thanh toán hóa đơn thành công',
        exampleData: SAMPLE_INVOICE,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Hóa đơn này đã được thanh toán đủ toàn bộ',
        error: 'Bad Request',
        path: '/api/v1/invoices/:id/pay',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, record_payment_dto_1.RecordPaymentDto, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "recordPayment", null);
exports.InvoicesController = InvoicesController = __decorate([
    (0, swagger_1.ApiTags)('Invoices (Hóa đơn & Thu ngân)'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('invoices'),
    __metadata("design:paramtypes", [invoices_service_1.InvoicesService])
], InvoicesController);
//# sourceMappingURL=invoices.controller.js.map