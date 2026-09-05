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
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const skip_transform_decorator_1 = require("../common/decorators/skip-transform.decorator");
const rooms_service_1 = require("./rooms.service");
const room_events_service_1 = require("./room-events.service");
const create_room_dto_1 = require("./dto/create-room.dto");
const update_room_dto_1 = require("./dto/update-room.dto");
const query_available_rooms_dto_1 = require("./dto/query-available-rooms.dto");
const query_rooms_dto_1 = require("./dto/query-rooms.dto");
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
    image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
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
    constructor(roomsService, roomEvents) {
        this.roomsService = roomsService;
        this.roomEvents = roomEvents;
    }
    create(createRoomDto, user) {
        if (user && user.role !== client_1.Role.ADMIN) {
            createRoomDto.status = client_1.RoomStatus.PENDING_APPROVAL;
        }
        return this.roomsService.create(createRoomDto);
    }
    stream(user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        const ready$ = (0, rxjs_1.of)({
            type: 'ready',
            retry: 5000,
            data: {
                message: 'Đã kết nối luồng cập nhật trạng thái phòng realtime',
                at: new Date().toISOString(),
            },
        });
        const ping$ = (0, rxjs_1.interval)(20000).pipe((0, rxjs_1.map)(() => ({
            type: 'ping',
            data: { at: new Date().toISOString() },
        })));
        const changes$ = this.roomEvents.stream().pipe((0, operators_1.filter)((event) => {
            if (isStaff)
                return true;
            const status = event.room?.status;
            return status !== client_1.RoomStatus.PENDING_APPROVAL && status !== client_1.RoomStatus.REJECTED;
        }), (0, rxjs_1.map)((event) => ({
            type: event.type,
            data: event,
        })));
        return (0, rxjs_1.merge)(ready$, changes$, ping$);
    }
    search(searchDto, user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        return this.roomsService.search(searchDto, isStaff);
    }
    findAvailable(query, user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        return this.roomsService.findAvailable(query, isStaff);
    }
    findAll(query, user) {
        const isStaff = user?.role === client_1.Role.ADMIN || user?.role === client_1.Role.RECEPTIONIST;
        return this.roomsService.findAll(query, isStaff);
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
    syncStatus() {
        return this.roomsService.syncAllStatuses();
    }
    updateStatus(id, dto) {
        return this.roomsService.updateStatus(id, dto.status);
    }
    update(id, updateRoomDto) {
        return this.roomsService.update(id, updateRoomDto);
    }
    updatePut(id, updateRoomDto) {
        return this.roomsService.update(id, updateRoomDto);
    }
    remove(id) {
        return this.roomsService.remove(id);
    }
};
exports.RoomsController = RoomsController;
__decorate([
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST, client_1.Role.CUSTOMER),
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Tạo phòng mới (Admin tạo duyệt thẳng, vai trò khác tạo bản chờ duyệt PENDING_APPROVAL)',
        description: 'ADMIN tạo phòng sẽ vào hoạt động ngay (AVAILABLE). RECEPTIONIST / CUSTOMER tạo ra bản ghi ở trạng thái ' +
            'PENDING_APPROVAL, phải được duyệt qua PATCH /rooms/:id/approve mới hiển thị đón khách.',
    }),
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
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Sse)('stream'),
    (0, skip_transform_decorator_1.SkipTransform)(),
    (0, common_1.Header)('X-Accel-Buffering', 'no'),
    (0, swagger_1.ApiOperation)({
        summary: 'Luồng realtime trạng thái phòng (SSE) — tự cập nhật khi phòng đổi trạng thái',
        description: 'Trả về `text/event-stream`. Client (Web Lễ tân / Mobile App) mở kết nối một lần và nhận sự kiện ngay khi ' +
            'phòng chuyển trạng thái (Trống -> Đang ở -> Dọn dẹp -> Bảo trì, v.v.) mà không cần F5 hoặc gọi lại `GET /rooms`.\n\n' +
            '**Tên sự kiện:** `ready` (kết nối thành công), `ping` (giữ kết nối mỗi 20s), ' +
            '`room.status_changed` (đổi trạng thái), `room.created` (phòng mới), `room.updated` (sửa thông tin), `room.deleted` (xóa phòng).\n\n' +
            '**Xác thực:** Chấp nhận token qua query: `GET /api/v1/rooms/stream?token=<accessToken>` hoặc header Bearer token.\n\n' +
            '**Phân quyền tự động:** Nhân viên (ADMIN / RECEPTIONIST) nhận đầy đủ sự kiện kể cả PENDING_APPROVAL và REJECTED. ' +
            'Khách hàng / khách vãng lai chỉ nhận các trạng thái phòng vận hành thông thường.\n\n' +
            '**Ví dụ (FE):**\n' +
            '```js\n' +
            "const es = new EventSource(`${API}/rooms/stream?token=${accessToken}`);\n" +
            "es.addEventListener('room.status_changed', (e) => {\n" +
            '  const { room } = JSON.parse(e.data);\n' +
            '  console.log(`Phòng ${room.roomNumber} đổi trạng thái thành ${room.status}`);\n' +
            '  updateRoomStatusInUI(room.id, room.status);\n' +
            '});\n' +
            '```',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'token',
        required: false,
        description: 'Access token dành cho EventSource (không gửi được header Authorization)',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], RoomsController.prototype, "stream", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
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
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
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
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Lấy danh sách tất cả phòng kèm bộ lọc trạng thái/tầng/hạng phòng & phân trang',
        description: 'Khách vãng lai và khách hàng chỉ thấy phòng đang vận hành. Phòng ở trạng thái ' +
            'PENDING_APPROVAL / REJECTED chỉ hiện với ADMIN và RECEPTIONIST (gửi kèm Bearer token). ' +
            'Response luôn có dạng { data: [...], meta: { total, page, limit, totalPages } }; ' +
            'không truyền page/limit thì trả về toàn bộ kết quả trong data.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách tất cả phòng thành công',
        exampleData: {
            data: [SAMPLE_ROOM],
            meta: { total: 20, page: 1, limit: 20, totalPages: 1 },
        },
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_rooms_dto_1.QueryRoomsDto, Object]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "findAll", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Xem chi tiết thông tin một phòng (Công khai cho khách vãng lai)' }),
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
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
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
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
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
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Post)('sync-status'),
    (0, swagger_1.ApiOperation)({
        summary: 'Rà soát & đồng bộ trạng thái toàn bộ phòng theo lịch đặt phòng thực tế',
        description: 'Chữa dữ liệu lệch giữa room.status và booking: phòng OCCUPIED nhưng không có đơn CHECKED_IN, ' +
            'hoặc phòng RESERVED nhưng đơn giữ chỗ đã bị hủy. Quy tắc suy diễn: có đơn CHECKED_IN -> OCCUPIED; ' +
            'có đơn CONFIRMED chưa tới ngày trả -> RESERVED; còn lại -> AVAILABLE. ' +
            'Phòng MAINTENANCE / PENDING_APPROVAL / REJECTED được giữ nguyên vì do người vận hành đặt tay.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Đồng bộ trạng thái phòng thành công',
        exampleData: {
            message: 'Đã đồng bộ lại trạng thái cho 5/20 phòng',
            totalRooms: 20,
            updatedCount: 5,
            changes: [
                { roomNumber: '103', from: 'OCCUPIED', to: 'AVAILABLE' },
                { roomNumber: '201', from: 'OCCUPIED', to: 'AVAILABLE' },
            ],
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "syncStatus", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
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
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cập nhật thông tin phòng (Chỉ Admin) — PATCH',
        description: 'Cập nhật một phần hoặc toàn bộ thông tin phòng (số phòng, tầng, hạng phòng, trạng thái, ghi chú) ' +
            'cũng như giá, tiện ích, ảnh của hạng phòng. Chỉ tài khoản ADMIN mới có quyền thực hiện.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật thông tin phòng thành công',
        exampleData: SAMPLE_ROOM,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'Không tìm thấy phòng với ID: 3f6c8d20-41ab-4f27-96a8-208935cba48b',
        error: 'Not Found',
        path: '/api/v1/rooms/3f6c8d20-41ab-4f27-96a8-208935cba48b',
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Số phòng 101 đã tồn tại',
        error: 'Conflict',
        path: '/api/v1/rooms/3f6c8d20-41ab-4f27-96a8-208935cba48b',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_room_dto_1.UpdateRoomDto]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cập nhật toàn diện thông tin phòng (Chỉ Admin) — PUT',
        description: 'Hỗ trợ phương thức PUT tương đương PATCH để tương thích hoàn toàn với các client HTTP/REST. ' +
            'Chỉ tài khoản ADMIN mới có quyền thực hiện.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật thông tin phòng thành công',
        exampleData: SAMPLE_ROOM,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'Không tìm thấy phòng với ID: 3f6c8d20-41ab-4f27-96a8-208935cba48b',
        error: 'Not Found',
        path: '/api/v1/rooms/3f6c8d20-41ab-4f27-96a8-208935cba48b',
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Số phòng 101 đã tồn tại',
        error: 'Conflict',
        path: '/api/v1/rooms/3f6c8d20-41ab-4f27-96a8-208935cba48b',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_room_dto_1.UpdateRoomDto]),
    __metadata("design:returntype", void 0)
], RoomsController.prototype, "updatePut", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
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
    __metadata("design:paramtypes", [rooms_service_1.RoomsService,
        room_events_service_1.RoomEventsService])
], RoomsController);
//# sourceMappingURL=rooms.controller.js.map