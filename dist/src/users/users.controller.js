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
const admin_change_password_dto_1 = require("./dto/admin-change-password.dto");
const update_me_dto_1 = require("./dto/update-me.dto");
const update_fcm_token_dto_1 = require("./dto/update-fcm-token.dto");
const query_users_dto_1 = require("./dto/query-users.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
const client_1 = require("@prisma/client");
const SAMPLE_USER = {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    email: 'reception@hotel.com',
    fullName: 'LÃª Thu HÃ  (Lá»… TÃ¢n)',
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
    updateFcmToken(userId, dto) {
        return this.usersService.updateFcmToken(userId, dto.fcmToken);
    }
    create(dto) {
        return this.usersService.create(dto);
    }
    findAll(query) {
        return this.usersService.findAll(query);
    }
    stream() {
        const ready$ = (0, rxjs_1.of)({
            type: 'ready',
            retry: 5000,
            data: {
                message: 'ÄÃ£ káº¿t ná»‘i luá»“ng cáº­p nháº­t tÃ i khoáº£n',
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
    adminChangePassword(id, dto) {
        return this.usersService.adminChangePassword(id, dto);
    }
    remove(id) {
        return this.usersService.remove(id);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Cáº­p nháº­t thÃ´ng tin tÃ i khoáº£n hiá»‡n táº¡i (Má»¥c 03 - P1)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cáº­p nháº­t há»“ sÆ¡ thÃ nh cÃ´ng',
        exampleData: SAMPLE_USER,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_me_dto_1.UpdateMeDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Patch)('fcm-token'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cập nhật FCM Token cho thiết bị người dùng',
        description: 'Lưu token thiết bị để nhận push notification thông báo trả phòng và dịch vụ',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cập nhật FCM token thành công',
        exampleData: { message: 'Cập nhật FCM token thành công', fcmToken: 'fZ0yZ...xyz' },
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_fcm_token_dto_1.UpdateFcmTokenDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateFcmToken", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin táº¡o tÃ i khoáº£n nhÃ¢n viÃªn (Lá»… tÃ¢n / Thu ngÃ¢n / Admin)',
        description: 'ÄÆ°á»ng chÃ­nh thá»©c Ä‘á»ƒ cáº¥p tÃ i khoáº£n ná»™i bá»™, thay cho viá»‡c mÆ°á»£n POST /auth/register ' +
            '(Ä‘Äƒng kÃ½ cÃ´ng khai luÃ´n Ã©p vai trÃ² CUSTOMER).',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Táº¡o tÃ i khoáº£n nhÃ¢n viÃªn thÃ nh cÃ´ng',
        exampleData: SAMPLE_USER,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½ trong há»‡ thá»‘ng',
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
    (0, swagger_1.ApiOperation)({
        summary: 'Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng & phÃ¢n trang (Admin & Receptionist)',
        description: 'Response luÃ´n cÃ³ dáº¡ng { data: [...], meta: { total, page, limit, totalPages } }; ' +
            'khÃ´ng truyá»n page/limit thÃ¬ tráº£ vá» toÃ n bá»™ káº¿t quáº£ trong data.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
        exampleData: {
            data: [SAMPLE_USER],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        },
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_users_dto_1.QueryUsersDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Sse)('stream'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, skip_transform_decorator_1.SkipTransform)(),
    (0, common_1.Header)('X-Accel-Buffering', 'no'),
    (0, swagger_1.ApiOperation)({
        summary: 'Luá»“ng realtime danh sÃ¡ch tÃ i khoáº£n (SSE) â€” tá»± bÃ¡o khi cÃ³ ngÆ°á»i Ä‘Äƒng kÃ½ má»›i',
        description: 'Tráº£ vá» `text/event-stream`. Client má»Ÿ káº¿t ná»‘i má»™t láº§n vÃ  nháº­n sá»± kiá»‡n ngay khi cÃ³ tÃ i khoáº£n má»›i, ' +
            'thay vÃ¬ pháº£i F5 hoáº·c gá»i láº¡i `GET /users`.\n\n' +
            '**TÃªn sá»± kiá»‡n:** `ready` (má»Ÿ luá»“ng thÃ nh cÃ´ng), `ping` (giá»¯ káº¿t ná»‘i má»—i 20 giÃ¢y), ' +
            '`user.created` (tÃ i khoáº£n má»›i), `user.updated` (Ä‘á»•i thÃ´ng tin / vai trÃ²), `user.deactivated` (khÃ³a tÃ i khoáº£n).\n\n' +
            '**XÃ¡c thá»±c:** `EventSource` cá»§a trÃ¬nh duyá»‡t khÃ´ng gá»­i Ä‘Æ°á»£c header `Authorization`, ' +
            'nÃªn endpoint nÃ y cháº¥p nháº­n token qua query: `GET /api/v1/users/stream?token=<accessToken>`.\n\n' +
            '**VÃ­ dá»¥ (FE):**\n' +
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
        description: 'Access token dÃ nh cho EventSource (khÃ´ng gá»­i Ä‘Æ°á»£c header Authorization)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", rxjs_1.Observable)
], UsersController.prototype, "stream", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, swagger_1.ApiOperation)({ summary: 'Chi tiáº¿t ngÆ°á»i dÃ¹ng theo ID' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xem thÃ´ng tin chi tiáº¿t ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
        exampleData: SAMPLE_USER,
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng vá»›i ID tÆ°Æ¡ng á»©ng',
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
    (0, swagger_1.ApiOperation)({ summary: 'Cáº­p nháº­t thÃ´ng tin / vai trÃ² ngÆ°á»i dÃ¹ng (Chá»‰ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Cáº­p nháº­t thÃ´ng tin ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
        exampleData: SAMPLE_USER,
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/password'),
    (0, common_1.Post)(':id/password'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin Ä‘á»•i / Ä‘áº·t láº¡i máº­t kháº©u cho tÃ i khoáº£n ngÆ°á»i dÃ¹ng',
        description: 'Cho phÃ©p Quáº£n trá»‹ viÃªn Ä‘á»•i máº­t kháº©u cho cÃ¡c tÃ i khoáº£n khÃ¡c mÃ  khÃ´ng cáº§n biáº¿t máº­t kháº©u cÅ©.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Äá»•i máº­t kháº©u tÃ i khoáº£n thÃ nh cÃ´ng',
        exampleData: {
            success: true,
            message: 'ÄÃ£ Ä‘á»•i máº­t kháº©u cho tÃ i khoáº£n LÃª Thu HÃ  (Lá»… TÃ¢n) thÃ nh cÃ´ng',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Máº­t kháº©u má»›i pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±',
        error: 'Bad Request',
        path: '/api/v1/users/:id/password',
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 404,
        message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng vá»›i ID tÆ°Æ¡ng á»©ng',
        error: 'Not Found',
        path: '/api/v1/users/:id/password',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_change_password_dto_1.AdminChangePasswordDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "adminChangePassword", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'VÃ´ hiá»‡u hÃ³a tÃ i khoáº£n (Chá»‰ Admin)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'VÃ´ hiá»‡u hÃ³a tÃ i khoáº£n ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
        exampleData: { ...SAMPLE_USER, isActive: false },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users (Quáº£n lÃ½ ngÆ°á»i dÃ¹ng & NhÃ¢n sá»±)'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        user_events_service_1.UserEventsService])
], UsersController);
//# sourceMappingURL=users.controller.js.map