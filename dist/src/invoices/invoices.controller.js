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
const create_payment_request_dto_1 = require("./dto/create-payment-request.dto");
const review_payment_dto_1 = require("./dto/review-payment.dto");
const refund_dto_1 = require("./dto/refund.dto");
const query_invoices_dto_1 = require("./dto/query-invoices.dto");
const query_payment_requests_dto_1 = require("./dto/query-payment-requests.dto");
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
    depositAmount: 1000000,
    remainingAmount: 0,
    pendingAmount: 0,
    hasPendingPaymentRequest: false,
    canRequestPayment: false,
    items: [
        { name: 'Tiền thuê phòng P.101', quantity: 1, unitPrice: 3600000, amount: 3600000 },
        { name: 'Minibar trọn gói', quantity: 1, unitPrice: 200000, amount: 200000 },
    ],
    payments: [
        {
            id: 'pay-0001',
            amount: 1000000,
            type: 'PAYMENT',
            paymentMethod: 'BANK_TRANSFER',
            paidAt: '2026-08-30T03:00:00.000Z',
            reference: null,
            note: 'Tiền cọc giữ chỗ khi duyệt phòng',
            cashierName: 'Lê Thu Ngân',
        },
        {
            id: 'pay-0002',
            amount: 2800000,
            type: 'PAYMENT',
            paymentMethod: 'CREDIT_CARD',
            paidAt: '2026-09-03T07:00:00.000Z',
            reference: 'FT25090312345678',
            note: null,
            cashierName: 'Lê Thu Ngân',
        },
    ],
    pendingPayments: [],
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
const SAMPLE_PAGINATED_INVOICES = {
    data: [SAMPLE_INVOICE],
    meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
    },
};
const SAMPLE_PAYMENT_REQUEST = {
    id: 'pay-0003',
    invoiceId: 'a9b8c7d6-e5f4-3210-fedc-ba9876543210',
    invoiceCode: 'INV-2025-0289',
    bookingCode: 'BK-2026-0829',
    roomNumber: '103',
    customerName: 'Nguyễn Văn A',
    customerPhone: '0912345678',
    amount: 2564000,
    paymentMethod: 'BANK_TRANSFER',
    status: 'PENDING',
    reference: 'FT25090512345678',
    note: 'Đã chuyển khoản lúc 14:05, nhờ lễ tân kiểm tra giúp',
    requestedAt: '2026-09-05T07:05:00.000Z',
    confirmedAt: null,
    confirmedByName: null,
    rejectedReason: null,
    invoiceFinalAmount: 5832000,
    invoicePaidAmount: 3268000,
    invoiceRemainingAmount: 2564000,
};
let InvoicesController = class InvoicesController {
    constructor(invoicesService) {
        this.invoicesService = invoicesService;
    }
    getSummary(date, staffId, currentUserId) {
        return this.invoicesService.getSummary(date, staffId, currentUserId);
    }
    findMine(userId, query) {
        return this.invoicesService.findMyInvoices(userId, query);
    }
    findPaymentRequests(query) {
        return this.invoicesService.findPaymentRequests(query);
    }
    confirmPayment(paymentId, dto, cashierId) {
        return this.invoicesService.confirmPayment(paymentId, dto, cashierId);
    }
    rejectPayment(paymentId, dto, cashierId) {
        return this.invoicesService.rejectPayment(paymentId, dto, cashierId);
    }
    create(dto, cashierId) {
        return this.invoicesService.create(dto, cashierId);
    }
    findAll(query) {
        return this.invoicesService.findAll(query);
    }
    findOne(id, userId, userRole) {
        return this.invoicesService.findOne(id, userId, userRole);
    }
    recordPayment(id, dto, cashierId) {
        return this.invoicesService.recordPayment(id, dto, cashierId);
    }
    createPaymentRequest(id, dto, userId, userRole) {
        return this.invoicesService.createPaymentRequest(id, dto, userId, userRole);
    }
    cancelPaymentRequest(id, paymentId, userId, userRole) {
        return this.invoicesService.cancelPaymentRequest(id, paymentId, userId, userRole);
    }
    refund(id, dto, staffId) {
        return this.invoicesService.refund(id, dto, staffId);
    }
};
exports.InvoicesController = InvoicesController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({ summary: 'Tổng quan doanh thu hôm nay hoặc sổ quỹ chốt ca (Lễ tân – Thu ngân)' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: false, description: 'today hoặc ngày theo định dạng YYYY-MM-DD' }),
    (0, swagger_1.ApiQuery)({ name: 'staffId', required: false, description: '"me" để xem chốt ca của chính mình, hoặc userId của nhân viên cụ thể' }),
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
    __param(1, (0, common_1.Query)('staffId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('my'),
    (0, swagger_1.ApiOperation)({
        summary: 'Hóa đơn của chính tôi (màn "Hóa đơn của tôi" bên app khách hàng)',
        description: 'Chỉ trả về hóa đơn thuộc các đơn đặt phòng của tài khoản đang đăng nhập. ' +
            'Nhân viên gọi endpoint này cũng chỉ thấy hóa đơn gắn với tài khoản của chính họ — ' +
            'muốn xem toàn bộ hóa đơn khách sạn thì dùng GET /invoices. Hỗ trợ phân trang qua page và limit.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách hóa đơn của tài khoản hiện tại thành công',
        exampleData: SAMPLE_PAGINATED_INVOICES,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, query_invoices_dto_1.QueryInvoicesDto]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "findMine", null);
__decorate([
    (0, common_1.Get)('payment-requests'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({
        summary: 'Hàng chờ đối chiếu: yêu cầu thanh toán khách gửi từ app',
        description: 'Khách bấm "Thanh toán" trên app sẽ tạo một yêu cầu PENDING, tiền CHƯA vào hóa đơn. ' +
            'Lễ tân đối chiếu sao kê / nhận tiền mặt rồi xác nhận qua POST /invoices/payments/:paymentId/confirm. ' +
            'Mặc định trả về các yêu cầu đang chờ. Hỗ trợ phân trang qua page và limit.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy hàng chờ đối chiếu thanh toán thành công',
        exampleData: {
            data: [SAMPLE_PAYMENT_REQUEST],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        },
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_payment_requests_dto_1.QueryPaymentRequestsDto]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "findPaymentRequests", null);
__decorate([
    (0, common_1.Post)('payments/:paymentId/confirm'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({
        summary: 'Xác nhận đã nhận được tiền của một yêu cầu thanh toán (Lễ tân – Thu ngân)',
        description: 'Chỉ sau bước này số tiền mới được cộng vào paidAmount của hóa đơn. ' +
            'Truyền amount nếu khách chuyển thiếu so với số đã yêu cầu.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xác nhận thanh toán thành công',
        exampleData: {
            message: 'Đã xác nhận thu 2.564.000đ. Hóa đơn đã thanh toán đủ.',
            paymentId: 'pay-0003',
            amount: 2564000,
            invoice: SAMPLE_INVOICE,
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Yêu cầu thanh toán này đã được xác nhận trước đó',
        error: 'Bad Request',
        path: '/api/v1/invoices/payments/:paymentId/confirm',
    }),
    __param(0, (0, common_1.Param)('paymentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, review_payment_dto_1.ConfirmPaymentDto, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Post)('payments/:paymentId/reject'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({
        summary: 'Từ chối yêu cầu thanh toán của khách (Lễ tân – Thu ngân)',
        description: 'Dùng khi không tìm thấy giao dịch trên sao kê. Lý do sẽ hiển thị lại cho khách trên app.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Từ chối yêu cầu thanh toán thành công',
        exampleData: {
            message: 'Đã từ chối yêu cầu thanh toán',
            paymentId: 'pay-0003',
            reason: 'Không tìm thấy giao dịch với mã FT25090512345678 trên sao kê',
            invoice: SAMPLE_INVOICE,
        },
    }),
    __param(0, (0, common_1.Param)('paymentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, review_payment_dto_1.RejectPaymentDto, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "rejectPayment", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
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
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({
        summary: 'Lấy danh sách hóa đơn theo trạng thái thanh toán & phân trang',
        description: 'Response luôn có dạng { data: [...], meta: { total, page, limit, totalPages } }; ' +
            'không truyền page/limit thì trả về toàn bộ kết quả trong data.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách hóa đơn thành công',
        exampleData: SAMPLE_PAGINATED_INVOICES,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_invoices_dto_1.QueryInvoicesDto]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CUSTOMER),
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
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({ summary: 'Ghi nhận thanh toán hóa đơn (Lễ tân – Thu ngân)' }),
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
__decorate([
    (0, common_1.Post)(':id/payment-requests'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CUSTOMER),
    (0, swagger_1.ApiOperation)({
        summary: 'Khách bấm "Thanh toán" trên app — gửi yêu cầu trả số tiền còn lại',
        description: 'BỎ TRỐNG `amount` để thanh toán TOÀN BỘ số còn lại của hóa đơn (nút "Thanh toán toàn bộ"). ' +
            'Truyền `amount` nếu khách chỉ trả một phần. ' +
            'Endpoint này KHÔNG cộng tiền ngay: nó tạo một yêu cầu ở trạng thái PENDING, ' +
            'lễ tân đối chiếu sao kê rồi xác nhận thì paidAmount mới tăng và "Còn thiếu" mới giảm. ' +
            'Mỗi hóa đơn chỉ được có một yêu cầu chờ tại một thời điểm; khách chỉ gửi được cho hóa đơn của chính mình.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Gửi yêu cầu thanh toán thành công',
        exampleData: {
            message: 'Đã gửi yêu cầu thanh toán toàn bộ số tiền còn lại. Lễ tân sẽ xác nhận sau khi đối chiếu.',
            paymentId: 'pay-0003',
            amount: 2564000,
            remainingAfterConfirm: 0,
            invoice: SAMPLE_INVOICE,
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Hóa đơn này đã được thanh toán đủ, không cần trả thêm',
        error: 'Bad Request',
        path: '/api/v1/invoices/:id/payment-requests',
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 403,
        message: 'Bạn chỉ có thể thanh toán hóa đơn thuộc đơn đặt phòng của chính mình',
        error: 'Forbidden',
        path: '/api/v1/invoices/:id/payment-requests',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(3, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_payment_request_dto_1.CreatePaymentRequestDto, String, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "createPaymentRequest", null);
__decorate([
    (0, common_1.Delete)(':id/payment-requests/:paymentId'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CUSTOMER),
    (0, swagger_1.ApiOperation)({
        summary: 'Hủy yêu cầu thanh toán chưa được lễ tân xác nhận',
        description: 'Dùng khi khách bấm nhầm hoặc muốn đổi sang trả tại quầy. Chỉ hủy được yêu cầu còn PENDING.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Hủy yêu cầu thanh toán thành công',
        exampleData: { message: 'Đã hủy yêu cầu thanh toán', invoice: SAMPLE_INVOICE },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('paymentId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(3, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "cancelPaymentRequest", null);
__decorate([
    (0, common_1.Post)(':id/refund'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({ summary: 'Hoàn tiền hóa đơn (Lễ tân – Thu ngân)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Hoàn tiền hóa đơn thành công',
        exampleData: SAMPLE_INVOICE,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Số tiền hoàn vượt quá số tiền đã thu hoặc hóa đơn chưa thanh toán',
        error: 'Bad Request',
        path: '/api/v1/invoices/:id/refund',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, refund_dto_1.RefundDto, String]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "refund", null);
exports.InvoicesController = InvoicesController = __decorate([
    (0, swagger_1.ApiTags)('Invoices (Hóa đơn & Thu ngân)'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('invoices'),
    __metadata("design:paramtypes", [invoices_service_1.InvoicesService])
], InvoicesController);
//# sourceMappingURL=invoices.controller.js.map