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
const confirm_booking_dto_1 = require("./dto/confirm-booking.dto");
const cancel_booking_dto_1 = require("./dto/cancel-booking.dto");
const query_bookings_dto_1 = require("./dto/query-bookings.dto");
const change_room_dto_1 = require("./dto/change-room.dto");
const request_service_dto_1 = require("./dto/request-service.dto");
const update_service_order_status_dto_1 = require("./dto/update-service-order-status.dto");
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
    status: 'PENDING',
    specialRequests: 'Nhận phòng tầng cao, yên tĩnh',
    confirmedAt: null,
    confirmedBy: null,
    confirmationNote: null,
    cancellationReason: null,
    cancelledAt: null,
    cancelledBy: null,
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
const CANCELLED_BOOKING_SAMPLE = {
    ...SAMPLE_BOOKING,
    status: 'CANCELLED',
    cancellationReason: 'Khách báo bận công tác đột xuất, xin hủy phòng',
    cancelledAt: '2026-09-04T03:20:00.000Z',
    cancelledBy: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        fullName: 'Nguyễn Văn Khách Hàng',
        role: 'CUSTOMER',
    },
};
let BookingsController = class BookingsController {
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    create(createBookingDto, userId, userRole) {
        return this.bookingsService.create(createBookingDto, userId, userRole);
    }
    findAll(userId, userRole, query) {
        return this.bookingsService.findAll({
            ...query,
            ...(userRole === client_1.Role.CUSTOMER ? { customerId: userId } : {}),
        }, userRole);
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
    confirm(id, dto, receptionistId) {
        return this.bookingsService.confirm(id, dto, receptionistId);
    }
    confirmPost(id, dto, receptionistId) {
        return this.bookingsService.confirm(id, dto, receptionistId);
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
    cancel(id, dto, userId, userRole) {
        return this.bookingsService.cancel(id, dto, userId, userRole);
    }
    cancelPatch(id, dto, userId, userRole) {
        return this.bookingsService.cancel(id, dto, userId, userRole);
    }
    addServiceOrder(id, dto) {
        return this.bookingsService.addServiceOrder(id, dto);
    }
    changeRoom(id, dto) {
        return this.bookingsService.changeRoom(id, dto);
    }
    requestService(id, dto, customerId) {
        return this.bookingsService.requestServiceOrder(id, dto, customerId);
    }
    updateServiceStatus(id, orderId, dto) {
        return this.bookingsService.updateServiceOrderStatus(id, orderId, dto);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Đặt phòng mới (Tự động tính tiền & phòng tránh trùng lịch)',
        description: 'Khách hàng (CUSTOMER) tự đặt luôn tạo đơn ở trạng thái PENDING để lễ tân xác nhận qua ' +
            'PATCH /bookings/{id}/confirm. Chỉ ADMIN / RECEPTIONIST mới được truyền status để tạo thẳng đơn CONFIRMED.',
    }),
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
    (0, swagger_1.ApiOperation)({
        summary: 'Xem danh sách đặt phòng (Lọc theo trạng thái, khoảng ngày, tìm kiếm, phân trang)',
        description: 'Toàn bộ việc lọc chạy phía máy chủ. Ví dụ màn "Nhận phòng hôm nay" của lễ tân: ' +
            '?status=PENDING,CONFIRMED&checkInFrom=2026-09-04&checkInTo=2026-09-04. ' +
            'Response luôn có dạng { data: [...], meta: { total, page, limit, totalPages } }; ' +
            'không truyền page/limit thì trả về toàn bộ kết quả trong data.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'status',
        required: false,
        isArray: true,
        enum: client_1.BookingStatus,
        description: 'Một hoặc nhiều trạng thái: ?status=PENDING,CONFIRMED hoặc lặp lại tham số',
    }),
    (0, swagger_1.ApiQuery)({ name: 'customerId', type: String, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'roomId', type: String, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'checkInFrom', type: String, required: false, example: '2026-09-04' }),
    (0, swagger_1.ApiQuery)({ name: 'checkInTo', type: String, required: false, example: '2026-09-04' }),
    (0, swagger_1.ApiQuery)({ name: 'checkOutFrom', type: String, required: false, example: '2026-09-06' }),
    (0, swagger_1.ApiQuery)({ name: 'checkOutTo', type: String, required: false, example: '2026-09-06' }),
    (0, swagger_1.ApiQuery)({
        name: 'search',
        type: String,
        required: false,
        description: 'Tìm theo tên khách / SĐT / email / mã đơn / số phòng',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', type: Number, required: false, example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', type: Number, required: false, example: 20 }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách đặt phòng thành công',
        exampleData: {
            data: [SAMPLE_BOOKING],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        },
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('role')),
    __param(2, (0, common_1.Query)(new common_1.ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, query_bookings_dto_1.QueryBookingsDto]),
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
    (0, common_1.Patch)(':id/confirm'),
    (0, swagger_1.ApiOperation)({
        summary: 'Lễ tân/Admin xác nhận đơn khách tự đặt (PENDING -> CONFIRMED)',
        description: 'Đường đi chính của màn "Chờ xác nhận". Body không bắt buộc: ' +
            'assignedRoomId để xếp khách sang phòng khác (có kiểm tra trùng lịch), ' +
            'note để ghi chú xác nhận, depositAmount để ghi nhận tiền cọc đã thu. ' +
            'Phòng được xếp chuyển sang RESERVED, phòng cũ (nếu đổi) tự động trả về đúng trạng thái.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xác nhận đơn đặt phòng thành công',
        exampleData: {
            message: 'Xác nhận đơn đặt phòng thành công',
            depositAmount: 500000,
            booking: {
                ...SAMPLE_BOOKING,
                status: 'CONFIRMED',
                depositAmount: 500000,
                confirmedAt: '2026-09-04T03:12:00.000Z',
                confirmedBy: { id: 'user-le-tan', fullName: 'Lê Thu Hà (Lễ Tân)', role: 'RECEPTIONIST' },
                confirmationNote: 'Khách đã chuyển khoản cọc, xếp phòng tầng cao theo yêu cầu',
            },
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Phòng 203 đã có đơn BK-2026-0830 trùng lịch trong khoảng thời gian này',
        error: 'Conflict',
        path: '/api/v1/bookings/:id/confirm',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, confirm_booking_dto_1.ConfirmBookingDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "confirm", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/confirm'),
    (0, swagger_1.ApiOperation)({ summary: 'Lễ tân/Admin xác nhận đơn đặt phòng (POST alias)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xác nhận đơn đặt phòng thành công',
        exampleData: {
            message: 'Xác nhận đơn đặt phòng thành công',
            depositAmount: 500000,
            booking: { ...SAMPLE_BOOKING, status: 'CONFIRMED', depositAmount: 500000 },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, confirm_booking_dto_1.ConfirmBookingDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "confirmPost", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Patch)(':id/reject'),
    (0, swagger_1.ApiOperation)({ summary: 'Lễ tân/Admin từ chối đơn đặt phòng mà khách đặt trước' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Từ chối đơn đặt phòng thành công',
        exampleData: {
            message: 'Từ chối đơn đặt phòng thành công',
            booking: CANCELLED_BOOKING_SAMPLE,
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
            booking: CANCELLED_BOOKING_SAMPLE,
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
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
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
    (0, swagger_1.ApiOperation)({
        summary: 'Hủy đơn đặt phòng kèm lý do và giải phóng trạng thái phòng',
        description: 'Nhận body { cancellationReason }. Lý do được lưu lại và trả về trong mọi response của đơn ' +
            'kèm cancelledAt và cancelledBy, để khách thấy được vì sao đơn bị hủy. ' +
            'KHÁCH HÀNG chỉ được tự hủy khi đơn còn PENDING; lễ tân đã xác nhận (CONFIRMED) thì khách ' +
            'phải liên hệ lễ tân. ADMIN/RECEPTIONIST hủy hộ được cả đơn CONFIRMED, nhưng đơn đã ' +
            'CHECKED_IN / CHECKED_OUT thì không vai trò nào hủy được.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Hủy đơn đặt phòng thành công',
        exampleData: CANCELLED_BOOKING_SAMPLE,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 403,
        message: 'Đơn đặt phòng đã được lễ tân xác nhận nên không thể tự hủy. Vui lòng liên hệ lễ tân để được hỗ trợ.',
        error: 'Forbidden',
        path: '/api/v1/bookings/:id/cancel',
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Khách đang ở phòng, không thể hủy đơn đặt',
        error: 'Bad Request',
        path: '/api/v1/bookings/:id/cancel',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(3, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_booking_dto_1.CancelBookingDto, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    (0, swagger_1.ApiOperation)({
        summary: 'Hủy đơn đặt phòng kèm lý do (PATCH alias cho client Flutter)',
        description: 'Cùng quy tắc với POST :id/cancel — khách chỉ tự hủy được đơn PENDING, đơn đã xác nhận ' +
            'hoặc đã nhận phòng thì không.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Hủy đơn đặt phòng thành công',
        exampleData: CANCELLED_BOOKING_SAMPLE,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 403,
        message: 'Đơn đặt phòng đã được lễ tân xác nhận nên không thể tự hủy. Vui lòng liên hệ lễ tân để được hỗ trợ.',
        error: 'Forbidden',
        path: '/api/v1/bookings/:id/cancel',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(3, (0, current_user_decorator_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_booking_dto_1.CancelBookingDto, String, String]),
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
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/change-room'),
    (0, swagger_1.ApiOperation)({ summary: 'Đổi phòng cho khách đang lưu trú tại khách sạn (S2 - P1)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Đổi phòng thành công',
        exampleData: {
            message: 'Đổi phòng thành công',
            booking: SAMPLE_BOOKING,
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Chỉ có thể đổi phòng cho đơn đang lưu trú CHECKED_IN hoặc phòng mới không khả dụng',
        error: 'Bad Request',
        path: '/api/v1/bookings/:id/change-room',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, change_room_dto_1.ChangeRoomDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "changeRoom", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.CUSTOMER),
    (0, common_1.Post)(':id/service-requests'),
    (0, swagger_1.ApiOperation)({ summary: 'Khách hàng gọi dịch vụ tại phòng (C1 - P1)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Yêu cầu dịch vụ phòng thành công',
        exampleData: {
            id: 'srv-req-123',
            bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
            serviceName: 'Giặt là cao cấp',
            quantity: 2,
            unitPrice: 50000,
            totalPrice: 100000,
            status: 'REQUESTED',
            note: 'Giao trước 10h',
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, request_service_dto_1.RequestServiceDto, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "requestService", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Patch)(':id/services/:orderId'),
    (0, swagger_1.ApiOperation)({ summary: 'Lễ tân duyệt hoặc từ chối yêu cầu dịch vụ của khách (C1 - P1)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật trạng thái yêu cầu dịch vụ thành công',
        exampleData: {
            id: 'srv-req-123',
            bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
            status: 'CONFIRMED',
            note: 'Đã giao đồ lên phòng',
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_service_order_status_dto_1.UpdateServiceOrderStatusDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "updateServiceStatus", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)('Bookings (Đặt phòng & Lưu trú)'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('bookings'),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map