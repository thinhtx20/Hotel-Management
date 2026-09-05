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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const register_dto_1 = require("./dto/register.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const logout_dto_1 = require("./dto/logout.dto");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
const verify_otp_dto_1 = require("./dto/verify-otp.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
const change_password_dto_1 = require("./dto/change-password.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const public_decorator_1 = require("../common/decorators/public.decorator");
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    deviceOf(req) {
        const forwarded = req?.headers?.['x-forwarded-for'];
        const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        return {
            userAgent: req?.headers?.['user-agent'],
            ip: forwardedIp?.split(',')[0]?.trim() || req?.ip,
        };
    }
    register(registerDto, req) {
        return this.authService.register(registerDto, this.deviceOf(req));
    }
    login(loginDto, req) {
        return this.authService.login(loginDto, this.deviceOf(req));
    }
    refreshToken(refreshTokenDto) {
        return this.authService.refreshToken(refreshTokenDto);
    }
    forgotPassword(forgotPasswordDto) {
        return this.authService.forgotPassword(forgotPasswordDto);
    }
    verifyResetOtp(verifyOtpDto) {
        return this.authService.verifyResetOtp(verifyOtpDto);
    }
    resetPassword(resetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto);
    }
    getProfile(userId) {
        return this.authService.getProfile(userId);
    }
    changePassword(userId, dto) {
        return this.authService.changePassword(userId, dto);
    }
    logout(userId, dto, req) {
        const authHeader = req?.headers?.authorization;
        let accessToken;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.substring(7).trim();
        }
        return this.authService.logout(userId, dto?.refreshToken, accessToken);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Đăng ký tài khoản người dùng mới' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 201,
        description: 'Đăng ký tài khoản thành công',
        exampleData: {
            user: {
                id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
                email: 'customer@hotel.com',
                fullName: 'Nguyễn Văn Khách Hàng',
                phone: '0912345678',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                role: 'CUSTOMER',
                createdAt: '2026-09-03T07:00:00.000Z',
            },
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            expiresIn: '1h',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 409,
        message: 'Email này đã được đăng ký trong hệ thống',
        error: 'Conflict',
        path: '/api/v1/auth/register',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiOperation)({
        summary: 'Đăng nhập hệ thống',
        description: 'Tài khoản **khách hàng (CUSTOMER)** chỉ được đăng nhập trên 1 thiết bị tại một thời điểm.\n\n' +
            '- Mặc định (`SINGLE_DEVICE_MODE=kick_old`): đăng nhập ở máy mới thành công và **đá phiên ở máy cũ ra**. ' +
            'Máy cũ sẽ nhận `401` với `error: "SESSION_REVOKED"` ở request kế tiếp — FE bắt mã này để xóa token và về màn đăng nhập.\n' +
            '- Nếu đặt `SINGLE_DEVICE_MODE=block_new`: máy mới bị từ chối `401` với `error: "SESSION_DEVICE_LIMIT"` ' +
            'cho tới khi máy cũ đăng xuất.\n\n' +
            'Tài khoản ADMIN / RECEPTIONIST không bị giới hạn số thiết bị.',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Đăng nhập thành công',
        exampleData: {
            user: {
                id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
                email: 'admin@hotel.com',
                fullName: 'Quản Trị Viên (Super Admin)',
                phone: '0901112233',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                role: 'ADMIN',
            },
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            expiresIn: '1h',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 401,
        message: 'Email hoặc mật khẩu không chính xác',
        error: 'Unauthorized',
        path: '/api/v1/auth/login',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh-token'),
    (0, swagger_1.ApiOperation)({ summary: 'Làm mới Access Token bằng Refresh Token' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Làm mới token thành công',
        exampleData: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            expiresIn: '1h',
            user: {
                id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
                email: 'admin@hotel.com',
                fullName: 'Quản Trị Viên (Super Admin)',
                phone: '0901112233',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                role: 'ADMIN',
            },
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 401,
        message: 'Refresh token không hợp lệ hoặc đã hết hạn',
        error: 'Unauthorized',
        path: '/api/v1/auth/refresh-token',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "refreshToken", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('forgot-password'),
    (0, swagger_1.ApiOperation)({ summary: 'Yêu cầu quên mật khẩu (Gửi mã OTP qua email)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Đã gửi mã OTP về email (hoặc ghi log dev)',
        message: 'Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 15 phút.',
        exampleData: {
            success: true,
            message: 'Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 15 phút.',
            email: 'customer@hotel.com',
            expiresInMinutes: 15,
            debugOtp: '123456',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'email phải đúng định dạng',
        error: 'Bad Request',
        path: '/api/v1/auth/forgot-password',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('verify-reset-otp'),
    (0, swagger_1.ApiOperation)({ summary: 'Xác thực mã OTP để lấy resetToken' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Xác thực mã OTP thành công',
        message: 'Xác thực mã OTP thành công. Bạn có thể đặt mật khẩu mới ngay bây giờ.',
        exampleData: {
            success: true,
            message: 'Xác thực mã OTP thành công. Bạn có thể đặt mật khẩu mới ngay bây giờ.',
            resetToken: 'a1b2c3d4e5f678901234567890abcdef...',
            email: 'customer@hotel.com',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
        error: 'Bad Request',
        path: '/api/v1/auth/verify-reset-otp',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyResetOtp", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('reset-password'),
    (0, swagger_1.ApiOperation)({ summary: 'Đặt lại mật khẩu mới (Bằng resetToken hoặc cặp email + OTP)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Đặt lại mật khẩu thành công',
        message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
        exampleData: {
            success: true,
            message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Thông tin xác thực không hợp lệ hoặc đã hết hạn',
        error: 'Bad Request',
        path: '/api/v1/auth/reset-password',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Lấy thông tin tài khoản hiện tại' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy thông tin tài khoản thành công',
        exampleData: {
            id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
            email: 'admin@hotel.com',
            fullName: 'Quản Trị Viên (Super Admin)',
            phone: '0901112233',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
            role: 'ADMIN',
            isActive: true,
            createdAt: '2026-09-03T07:00:00.000Z',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 401,
        message: 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn',
        error: 'Unauthorized',
        path: '/api/v1/auth/me',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('change-password'),
    (0, swagger_1.ApiOperation)({ summary: 'Đổi mật khẩu cho người dùng hiện tại (Mục 03 - P1)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Đổi mật khẩu thành công',
        message: 'Đổi mật khẩu thành công',
        exampleData: {
            success: true,
            message: 'Đổi mật khẩu thành công',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Mật khẩu hiện tại không chính xác',
        error: 'Bad Request',
        path: '/api/v1/auth/change-password',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, change_password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiOperation)({
        summary: 'Đăng xuất tài khoản và thu hồi token (Hỗ trợ Bearer Token hoặc Refresh Token)',
        description: 'Thu hồi Refresh Token trong Redis và đưa Access Token vào Blacklist. Hỗ trợ gọi khi còn Access Token hoặc đã hết hạn (chỉ cần truyền Refresh Token trong body).',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Đăng xuất thành công',
        message: 'Đăng xuất thành công',
        exampleData: {
            success: true,
            message: 'Đăng xuất thành công',
        },
    }),
    (0, api_success_response_decorator_1.ApiErrorResponse)({
        status: 400,
        message: 'Vui lòng cung cấp Access Token (Bearer) hoặc Refresh Token để đăng xuất',
        error: 'Bad Request',
        path: '/api/v1/auth/logout',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, logout_dto_1.LogoutDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Authentication'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map