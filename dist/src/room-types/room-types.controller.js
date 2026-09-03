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
exports.RoomTypesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const room_types_service_1 = require("./room-types.service");
const create_room_type_dto_1 = require("./dto/create-room-type.dto");
const update_room_type_dto_1 = require("./dto/update-room-type.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const public_decorator_1 = require("../common/decorators/public.decorator");
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
const client_1 = require("@prisma/client");
const SAMPLE_ROOM_TYPE = {
    id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
    name: 'Phòng Deluxe Hướng Biển',
    code: 'DELUXE_OCEAN',
    description: 'Phòng cao cấp ngắm trọn bình minh trên biển',
    basePrice: 1200000,
    capacityAdults: 2,
    capacityChildren: 1,
    sizeSqM: 38,
    amenities: ['Wifi tốc độ cao', 'Ban công view biển', 'Bồn tắm nằm', 'Smart TV 55 inch'],
    images: [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    ],
    createdAt: '2026-09-03T07:00:00.000Z',
    updatedAt: '2026-09-03T07:00:00.000Z',
};
let RoomTypesController = class RoomTypesController {
    constructor(roomTypesService) {
        this.roomTypesService = roomTypesService;
    }
    create(createRoomTypeDto) {
        return this.roomTypesService.create(createRoomTypeDto);
    }
    findAll() {
        return this.roomTypesService.findAll();
    }
    findOne(id) {
        return this.roomTypesService.findOne(id);
    }
    update(id, updateRoomTypeDto) {
        return this.roomTypesService.update(id, updateRoomTypeDto);
    }
    remove(id) {
        return this.roomTypesService.remove(id);
    }
};
exports.RoomTypesController = RoomTypesController;
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Tạo loại phòng mới (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Tạo loại phòng mới thành công',
        exampleData: SAMPLE_ROOM_TYPE,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Tên hoặc mã loại phòng đã tồn tại trong hệ thống',
        error: 'Conflict',
        path: '/api/v1/room-types',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_room_type_dto_1.CreateRoomTypeDto]),
    __metadata("design:returntype", void 0)
], RoomTypesController.prototype, "create", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Lấy danh sách loại phòng và tiện nghi (Công khai)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách loại phòng thành công',
        exampleData: [SAMPLE_ROOM_TYPE],
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RoomTypesController.prototype, "findAll", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Chi tiết một loại phòng (Công khai)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy chi tiết loại phòng thành công',
        exampleData: SAMPLE_ROOM_TYPE,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'Không tìm thấy loại phòng với ID tương ứng',
        error: 'Not Found',
        path: '/api/v1/room-types/:id',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomTypesController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Cập nhật loại phòng và đơn giá (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật loại phòng thành công',
        exampleData: SAMPLE_ROOM_TYPE,
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_room_type_dto_1.UpdateRoomTypeDto]),
    __metadata("design:returntype", void 0)
], RoomTypesController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Xóa loại phòng (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xóa loại phòng thành công',
        exampleData: { id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564' },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomTypesController.prototype, "remove", null);
exports.RoomTypesController = RoomTypesController = __decorate([
    (0, swagger_1.ApiTags)('Room Types (Loại phòng & Giá)'),
    (0, common_1.Controller)('room-types'),
    __metadata("design:paramtypes", [room_types_service_1.RoomTypesService])
], RoomTypesController);
//# sourceMappingURL=room-types.controller.js.map