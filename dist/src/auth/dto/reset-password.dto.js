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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ResetPasswordDto {
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'admin@hotel.com',
        description: 'Email của tài khoản (Bắt buộc nếu xác thực bằng OTP)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: 'Email không hợp lệ' }),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim().toLowerCase()),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '123456',
        description: 'Mã OTP gồm 6 chữ số (Bắt buộc nếu xác thực bằng OTP)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Mã OTP phải là chuỗi' }),
    (0, class_validator_1.Length)(6, 6, { message: 'Mã OTP phải đúng 6 chữ số' }),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "otp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'd9b7a4c28f1e6a5b...',
        description: 'Mã Token đặt lại mật khẩu (Nhận được sau khi verify OTP)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'Token đặt lại mật khẩu phải là chuỗi' }),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "resetToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'NewSecret@2026',
        description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Mật khẩu mới không được để trống' }),
    (0, class_validator_1.IsString)({ message: 'Mật khẩu mới phải là chuỗi' }),
    (0, class_validator_1.MinLength)(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' }),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "newPassword", void 0);
//# sourceMappingURL=reset-password.dto.js.map