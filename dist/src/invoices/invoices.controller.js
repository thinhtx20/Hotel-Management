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
    findAll(status) {
        return this.invoicesService.findAll(status);
    }
    findOne(id) {
        return this.invoicesService.findOne(id);
    }
    recordPayment(id, dto, cashierId) {
        return this.invoicesService.recordPayment(id, dto, cashierId);
    }
};
exports.InvoicesController = InvoicesController;
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
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CASHIER),
    (0, swagger_1.ApiOperation)({ summary: 'Xem chi tiết hóa đơn, tiền phòng và bảng kê dịch vụ phụ trợ' }),
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
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
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