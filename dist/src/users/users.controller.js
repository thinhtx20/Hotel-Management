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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const user_events_service_1 = require("./user-events.service");
const skip_transform_decorator_1 = require("../common/decorators/skip-transform.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const update_user_dto_1 = require("./dto/update-user.dto");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_me_dto_1 = require("./dto/update-me.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
const client_1 = require("@prisma/client");
const SAMPLE_USER = {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    email: 'reception@hotel.com',
    fullName: 'Lê Thu Hà (Lễ Tân)',
    phone: '0903334455',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    role: 'RECEPTIONIST',
    isActive: true,
    createdAt: '2026-09-03T07:00:00.000Z',
};
let UsersController = class UsersController {
    constructor(usersService, userEvents) {
        this.usersService = usersService;
        this.userEvents = userEvents;
    }
    updateMe(userId, dto) {
        return this.usersService.updateMe(userId, dto);
    }
    create(dto) {
        return this.usersService.create(dto);
    }
    findAll(role) {
        return this.usersService.findAll(role);
    }
    stream() {
        const ready$ = (0, rxjs_1.of)({
            type: 'ready',
            retry: 5000,
            data: {
                message: 'Đã kết nối luồng cập nhật tài khoản',
                at: new Date().toISOString(),
            },
        });
        const ping$ = (0, rxjs_1.interval)(20000).pipe((0, operators_1.map)(() => ({
            type: 'ping',
            data: { at: new Date().toISOString() },
        })));
        const changes$ = this.userEvents.stream().pipe((0, operators_1.map)((event) => ({
            type: event.type,
            data: event,
        })));
        return (0, rxjs_1.merge)(ready$, changes$, ping$);
    }
    findOne(id) {
        return this.usersService.findOne(id);
    }
    update(id, updateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }
    remove(id) {
        return this.usersService.remove(id);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Cập nhật thông tin tài khoản hiện tại (Mục 03 - P1)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật hồ sơ thành công',
        exampleData: SAMPLE_USER,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_me_dto_1.UpdateMeDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin tạo tài khoản nhân viên (Lễ tân / Thu ngân / Admin)',
        description: 'Đường chính thức để cấp tài khoản nội bộ, thay cho việc mượn POST /auth/register ' +
            '(đăng ký công khai luôn ép vai trò CUSTOMER).',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Tạo tài khoản nhân viên thành công',
        exampleData: SAMPLE_USER,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Email này đã được đăng ký trong hệ thống',
        error: 'Conflict',
        path: '/api/v1/users',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({ summary: 'Lấy danh sách người dùng (Admin & Receptionist)' }),
    (0, swagger_1.ApiQuery)({ name: 'role', enum: client_1.Role, required: false, description: 'Lọc theo vai trò' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy danh sách người dùng thành công',
        exampleData: [SAMPLE_USER],
    }),
    __param(0, (0, common_1.Query)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Sse)('stream'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, skip_transform_decorator_1.SkipTransform)(),
    (0, common_1.Header)('X-Accel-Buffering', 'no'),
    (0, swagger_1.ApiOperation)({
        summary: 'Luồng realtime danh sách tài khoản (SSE) — tự báo khi có người đăng ký mới',
        description: 'Trả về `text/event-stream`. Client mở kết nối một lần và nhận sự kiện ngay khi có tài khoản mới, ' +
            'thay vì phải F5 hoặc gọi lại `GET /users`.\n\n' +
            '**Tên sự kiện:** `ready` (mở luồng thành công), `ping` (giữ kết nối mỗi 20 giây), ' +
            '`user.created` (tài khoản mới), `user.updated` (đổi thông tin / vai trò), `user.deactivated` (khóa tài khoản).\n\n' +
            '**Xác thực:** `EventSource` của trình duyệt không gửi được header `Authorization`, ' +
            'nên endpoint này chấp nhận token qua query: `GET /api/v1/users/stream?token=<accessToken>`.\n\n' +
            '**Ví dụ (FE):**\n' +
            '```js\n' +
            "const es = new EventSource(`${API}/users/stream?token=${accessToken}`);\n" +
            "es.addEventListener('user.created', (e) => {\n" +
            '  const { user } = JSON.parse(e.data);\n' +
            '  setUsers((prev) => [user, ...prev.filter((u) => u.id !== user.id)]);\n' +
            '});\n' +
            '```',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'token',
        required: false,
        description: 'Access token dành cho EventSource (không gửi được header Authorization)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", rxjs_1.Observable)
], UsersController.prototype, "stream", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({ summary: 'Chi tiết người dùng theo ID' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xem thông tin chi tiết người dùng thành công',
        exampleData: SAMPLE_USER,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'Không tìm thấy người dùng với ID tương ứng',
        error: 'Not Found',
        path: '/api/v1/users/:id',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Cập nhật thông tin / vai trò người dùng (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật thông tin người dùng thành công',
        exampleData: SAMPLE_USER,
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Vô hiệu hóa tài khoản (Chỉ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Vô hiệu hóa tài khoản người dùng thành công',
        exampleData: { ...SAMPLE_USER, isActive: false },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users (Quản lý người dùng & Nhân sự)'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        user_events_service_1.UserEventsService])
], UsersController);
//# sourceMappingURL=users.controller.js.map