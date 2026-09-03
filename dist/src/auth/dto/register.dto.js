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
exports.RegisterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class RegisterDto {
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'customer@hotel.com', description: 'Email tài khoản' }),
    (0, class_validator_1.IsEmail)({}, { message: 'Email không đúng định dạng' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Email là bắt buộc' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '123456', description: 'Mật khẩu tối thiểu 6 ký tự' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Mật khẩu là bắt buộc' }),
    (0, class_validator_1.MinLength)(6, { message: 'Mật khẩu phải có tối thiểu 6 ký tự' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Nguyễn Văn A', description: 'Họ và tên' }),
    (0, class_validator_1.IsString)({ message: 'Họ tên phải là chuỗi' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Họ tên không được để trống' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "fullName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '0912345678', description: 'Số điện thoại' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.Role, default: client_1.Role.CUSTOMER, description: 'Vai trò (Chỉ Admin mới được cấp quyền đặc biệt)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Role, { message: 'Vai trò không hợp lệ' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "role", void 0);
//# sourceMappingURL=register.dto.js.map