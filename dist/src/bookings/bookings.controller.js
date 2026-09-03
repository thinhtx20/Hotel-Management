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
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
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
    findOne(id) {
        return this.bookingsService.findOne(id);
    }
    checkIn(id) {
        return this.bookingsService.checkIn(id);
    }
    checkOut(id, checkOutDto, cashierId) {
        return this.bookingsService.checkOut(id, checkOutDto, cashierId);
    }
    cancel(id) {
        return this.bookingsService.cancel(id);
    }
    addServiceOrder(id, dto) {
        return this.bookingsService.addServiceOrder(id, dto);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Đặt phòng mới (Tự động tính tiền & phòng tránh trùng lịch)' }),
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
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "findOne", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/check-in'),
    (0, swagger_1.ApiOperation)({ summary: 'Check-in khách vào nhận phòng (Chuyển phòng sang OCCUPIED)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "checkIn", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CASHIER),
    (0, common_1.Post)(':id/check-out'),
    (0, swagger_1.ApiOperation)({ summary: 'Check-out trả phòng, tính tiền dịch vụ và xuất hóa đơn' }),
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
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancel", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)(':id/services'),
    (0, swagger_1.ApiOperation)({ summary: 'Ghi nhận sử dụng dịch vụ phụ trợ (Minibar, giặt là, ăn uống tại phòng)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_booking_status_dto_1.AddServiceOrderDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "addServiceOrder", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)('Bookings (Đặt phòng & Lưu trú)'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('bookings'),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map