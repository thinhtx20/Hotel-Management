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
exports.RoomsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const rooms_service_1 = require("./rooms.service");
const create_room_dto_1 = require("./dto/create-room.dto");
const update_room_dto_1 = require("./dto/update-room.dto");
const query_available_rooms_dto_1 = require("./dto/query-available-rooms.dto");
const search_room_dto_1 = require("./dto/search-room.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const public_decorator_1 = require("../common/decorators/public.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
const client_1 = require("@prisma/client");
const SAMPLE_ROOM = {
    id: '3f6c8d20-41ab-4f27-96a8-208935cba48b',
    roomNumber: '101',
    floor: 1,
    status: 'AVAILABLE',
    roomTypeId: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
    roomTypeName: 'Phòng Deluxe Hướng Biển',
    roomTypeCode: 'DELUXE_OCEAN',
    description: 'Phòng cao cấp ngắm trọn bình minh trên biển',
    pricePerNight: 1200000,
    images: [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    ],
    amenities: ['Wifi tốc độ cao', 'Ban công view biển', 'Bồn tắm nằm', 'Smart TV 55 inch'],
    capacityAdults: 2,
    capacityChildren: 1,
    sizeSqM: 38,
};
let RoomsController = class RoomsController {
    constructor(roomsService) {
        this.roomsService = roomsService;
    }
    create(createRoomDto, user) {
        if (user && user.role !== client_1.Role.ADMIN) {
            createRoomDto.status = client_1.RoomStatus.PENDING_APPROVAL;
        }
        return this.roomsService.create(createRoomDto);
    }
    search(searchDto, user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        return this.roomsService.search(searchDto, isStaff);
    }
    findAvailable(query, user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        return this.roomsService.findAvailable(query, isStaff);
    }
    findAll(status, floor, roomTypeId, user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        return this.roomsService.findAll(status, floor ? Number(floor) : undefined, roomTypeId, isStaff);
    }
    findOne(id, user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        return this.roomsService.findOne(id, isStaff);
    }
    approve(id) {
        return this.roomsService.updateStatus(id, client_1.RoomStatus.AVAILABLE);
    }
    reject(id) {
        return this.roomsService.updateStatus(id, client_1.RoomStatus.REJECTED);
    }
    updateStatus(id, dto) {
        return this.roomsService.updateStatus(id, dto.status);
    }
    update(id, updateRoomDto) {
        return this.roomsService.update(id, updateRoomDto);
    }
    remove(id) {
        return this.roomsService.remove(id);
    }
};
exports.RoomsController = RoomsController;
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CUSTOMER),
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Tạo phòng mới (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Tạo phòng mới thành công',
        exampleData: SAMPLE_ROOM,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Số phòng 101 đã tồn tại',
        error: 'Conflict',
        path: '/api/v1/rooms',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_room_dto_1.CreateRoomDto, Object]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "create", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Tìm kiếm phòng Full-Text siêu tốc bằng Elasticsearch (Fuzzy match, tiện ích, khoảng giá)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Tìm kiếm danh sách phòng thành công',
        exampleData: [SAMPLE_ROOM],
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_room_dto_1.SearchRoomDto, Object]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "search", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('available'),
    (0, swagger_1.ApiOperation)({ summary: 'Tìm kiếm danh sách phòng trống theo khoảng thời gian đặt phòng (Redis Caching)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách phòng trống thành công',
        exampleData: [SAMPLE_ROOM],
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_available_rooms_dto_1.QueryAvailableRoomsDto, Object]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "findAvailable", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Lấy danh sách tất cả phòng kèm bộ lọc trạng thái/tầng' }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: client_1.RoomStatus, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'floor', type: Number, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'roomTypeId', type: String, required: false }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách tất cả phòng thành công',
        exampleData: [SAMPLE_ROOM],
    }),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('floor')),
    __param(2, (0, common_1.Query)('roomTypeId')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String, Object]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "findAll", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Xem chi tiết thông tin một phòng' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xem chi tiết thông tin phòng thành công',
        exampleData: SAMPLE_ROOM,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'Không tìm thấy phòng với ID: 3f6c8d20-41ab-4f27-96a8-208935cba48b',
        error: 'Not Found',
        path: '/api/v1/rooms/3f6c8d20-41ab-4f27-96a8-208935cba48b',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Patch)(':id/approve'),
    (0, swagger_1.ApiOperation)({ summary: 'Phê duyệt phòng mới vào hoạt động' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Phê duyệt phòng thành công',
        exampleData: { ...SAMPLE_ROOM, status: 'AVAILABLE' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "approve", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Patch)(':id/reject'),
    (0, swagger_1.ApiOperation)({ summary: 'Từ chối duyệt phòng mới' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Từ chối duyệt phòng thành công',
        exampleData: { ...SAMPLE_ROOM, status: 'REJECTED' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "reject", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Cập nhật nhanh trạng thái phòng (Trống, Đang ở, Dọn dẹp, Bảo trì)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật trạng thái phòng thành công',
        exampleData: { ...SAMPLE_ROOM, status: 'CLEANING' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_room_dto_1.UpdateRoomStatusDto]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "updateStatus", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Cập nhật thông tin phòng (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật thông tin phòng thành công',
        exampleData: SAMPLE_ROOM,
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_room_dto_1.UpdateRoomDto]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Xóa phòng (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xóa phòng thành công',
        exampleData: { id: '3f6c8d20-41ab-4f27-96a8-208935cba48b', roomNumber: '101' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "remove", null);
exports.RoomsController = RoomsController = __decorate([
    (0, swagger_1.ApiTags)('Rooms (Quản lý Phòng & Tìm kiếm)'),
    (0, common_1.Controller)('rooms'),
    __metadata("design:paramtypes", [rooms_service_1.RoomsService])
], RoomsController);
//# sourceMappingURL=rooms.controller.js.map