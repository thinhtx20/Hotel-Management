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
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bookings_service_1 = require("./bookings.service");
const create_booking_dto_1 = require("./dto/create-booking.dto");
const update_booking_status_dto_1 = require("./dto/update-booking-status.dto");
const approve_booking_dto_1 = require("./dto/approve-booking.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
const client_1 = require("@prisma/client");
const SAMPLE_BOOKING = {
    id: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
    bookingCode: 'BK-2026-0829',
    customerId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    roomId: '3f6c8d20-41ab-4f27-96a8-208935cba48b',
    checkInDate: '2026-09-05T14:00:00.000Z',
    checkOutDate: '2026-09-08T12:00:00.000Z',
    actualCheckIn: null,
    actualCheckOut: null,
    guestCount: 2,
    totalAmount: 3600000,
    depositAmount: 1000000,
    status: 'CONFIRMED',
    specialRequests: 'Nhận phòng tầng cao, yên tĩnh',
    createdAt: '2026-09-03T07:00:00.000Z',
    room: {
        roomNumber: '101',
        floor: 1,
        roomType: {
            name: 'Phòng Deluxe Hướng Biển',
            basePrice: 1200000,
        },
    },
    customer: {
        fullName: 'Nguyễn Văn Khách Hàng',
        phone: '0912345678',
        email: 'customer@hotel.com',
    },
};
let BookingsController = class BookingsController {
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    create(createBookingDto, userId, userRole) {
        return this.bookingsService.create(createBookingDto, userId, userRole);
    }
    findAll(userId, userRole, status, customerId, roomId) {
        const finalCustomerId = userRole === client_1.Role.CUSTOMER ? userId : customerId;
        return this.bookingsService.findAll(status, finalCustomerId, roomId);
    }
    findOne(id, userId, userRole) {
        return this.bookingsService.findOne(id, userId, userRole);
    }
    approve(id, dto, receptionistId) {
        return this.bookingsService.approve(id, dto, receptionistId);
    }
    approvePost(id, dto, receptionistId) {
        return this.bookingsService.approve(id, dto, receptionistId);
    }
    reject(id, dto, receptionistId) {
        return this.bookingsService.reject(id, dto, receptionistId);
    }
    rejectPost(id, dto, receptionistId) {
        return this.bookingsService.reject(id, dto, receptionistId);
    }
    checkIn(id) {
        return this.bookingsService.checkIn(id);
    }
    checkOut(id, checkOutDto, cashierId) {
        return this.bookingsService.checkOut(id, checkOutDto, cashierId);
    }
    cancel(id, userId, userRole) {
        return this.bookingsService.cancel(id, userId, userRole);
    }
    cancelPatch(id, userId, userRole) {
        return this.bookingsService.cancel(id, userId, userRole);
    }
    addServiceOrder(id, dto) {
        return this.bookingsService.addServiceOrder(id, dto);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Đặt phòng mới (Tự động tính tiền & phòng tránh trùng lịch)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Đặt phòng thành công',
        exampleData: SAMPLE_BOOKING,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Phòng này đã có khách đặt hoặc đang có người lưu trú trong khoảng thời gian đã chọn',
        error: 'Conflict',
        path: '/api/v1/bookings',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_booking_dto_1.CreateBookingDto, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Xem danh sách đặt phòng (Hỗ trợ lọc theo trạng thái, khách hàng, phòng)' }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: client_1.BookingStatus, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'customerId', type: String, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'roomId', type: String, required: false }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách đặt phòng thành công',
        exampleData: [SAMPLE_BOOKING],
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('role')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('customerId')),
    __param(4, (0, common_1.Query)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Xem chi tiết đơn đặt phòng' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy thông tin chi tiết đơn đặt phòng thành công',
        exampleData: SAMPLE_BOOKING,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'Không tìm thấy đơn đặt phòng với ID tương ứng',
        error: 'Not Found',
        path: '/api/v1/bookings/:id',
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 403,
        message: 'Bạn chỉ có thể xem và thao tác trên đơn đặt phòng của chính mình',
        error: 'Forbidden',
        path: '/api/v1/bookings/:id',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "findOne", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Patch)(':id/approve'),
    (0, swagger_1.ApiOperation)({
        summary: 'Lễ tân/Admin phê duyệt đơn đặt phòng và xác nhận tiền cọc',
        description: 'Chuyển đơn từ PENDING sang CONFIRMED. Nếu có tiền cọc (depositAmount), tự động tạo/cập nhật hóa đơn cọc ' +
            'và chuyển trạng thái phòng sang RESERVED (Cam hổ phách).',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
        exampleData: {
            message: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
            depositAmount: 500000,
            booking: { ...SAMPLE_BOOKING, status: 'CONFIRMED', depositAmount: 500000 },
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Đơn đặt phòng này đã được phê duyệt trước đó hoặc đã bị hủy',
        error: 'Bad Request',
        path: '/api/v1/bookings/:id/approve',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_booking_dto_1.ApproveBookingDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "approve", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/approve'),
    (0, swagger_1.ApiOperation)({ summary: 'Lễ tân/Admin phê duyệt đơn đặt phòng (POST alias)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
        exampleData: {
            message: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
            depositAmount: 500000,
            booking: { ...SAMPLE_BOOKING, status: 'CONFIRMED', depositAmount: 500000 },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_booking_dto_1.ApproveBookingDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "approvePost", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Patch)(':id/reject'),
    (0, swagger_1.ApiOperation)({ summary: 'Lễ tân/Admin từ chối đơn đặt phòng mà khách đặt trước' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Từ chối đơn đặt phòng thành công',
        exampleData: {
            message: 'Từ chối đơn đặt phòng thành công',
            booking: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_booking_dto_1.RejectBookingDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "reject", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/reject'),
    (0, swagger_1.ApiOperation)({ summary: 'Lễ tân/Admin từ chối đơn đặt phòng (POST alias)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Từ chối đơn đặt phòng thành công',
        exampleData: {
            message: 'Từ chối đơn đặt phòng thành công',
            booking: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_booking_dto_1.RejectBookingDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "rejectPost", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/check-in'),
    (0, swagger_1.ApiOperation)({ summary: 'Check-in khách vào nhận phòng (Chuyển phòng sang OCCUPIED)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Check-in nhận phòng thành công',
        exampleData: { ...SAMPLE_BOOKING, status: 'CHECKED_IN', actualCheckIn: '2026-09-05T14:10:00.000Z' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "checkIn", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CASHIER),
    (0, common_1.Post)(':id/check-out'),
    (0, swagger_1.ApiOperation)({ summary: 'Check-out trả phòng, tính tiền dịch vụ và xuất hóa đơn' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Check-out và xuất hóa đơn thành công',
        exampleData: {
            booking: { ...SAMPLE_BOOKING, status: 'CHECKED_OUT', actualCheckOut: '2026-09-08T11:45:00.000Z' },
            invoice: {
                id: 'inv-1234',
                invoiceCode: 'INV-2026-0045',
                roomAmount: 3600000,
                servicesAmount: 250000,
                finalAmount: 3850000,
                paidAmount: 1000000,
                paymentStatus: 'PARTIAL',
            },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_booking_status_dto_1.CheckOutDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "checkOut", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, swagger_1.ApiOperation)({ summary: 'Hủy đơn đặt phòng và giải phóng trạng thái phòng' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Hủy đơn đặt phòng thành công',
        exampleData: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    (0, swagger_1.ApiOperation)({ summary: 'Hủy đơn đặt phòng (PATCH alias cho client Flutter)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Hủy đơn đặt phòng thành công',
        exampleData: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancelPatch", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/services'),
    (0, swagger_1.ApiOperation)({ summary: 'Ghi nhận sử dụng dịch vụ phụ trợ (Minibar, giặt là, ăn uống tại phòng)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Thêm dịch vụ phụ trợ vào phòng thành công',
        exampleData: {
            id: 'srv-123',
            bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
            serviceName: 'Nước ngọt lon Coca & Giặt là áo sơ mi',
            quantity: 2,
            unitPrice: 50000,
            totalPrice: 100000,
            orderedAt: '2026-09-03T07:00:00.000Z',
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_booking_status_dto_1.AddServiceOrderDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "addServiceOrder", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)('Bookings (Đặt phòng & Lưu trú)'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('bookings'),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map