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
exports.CheckOutDto = exports.AddServiceOrderDto = exports.UpdateBookingStatusDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class UpdateBookingStatusDto {
}
exports.UpdateBookingStatusDto = UpdateBookingStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.BookingStatus, example: client_1.BookingStatus.CHECKED_IN }),
    (0, class_validator_1.IsEnum)(client_1.BookingStatus),
    __metadata("design:type", String)
], UpdateBookingStatusDto.prototype, "status", void 0);
class AddServiceOrderDto {
}
exports.AddServiceOrderDto = AddServiceOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bia Heineken (Minibar)', description: 'Tên dịch vụ / đồ uống' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AddServiceOrderDto.prototype, "serviceName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 40000, description: 'Đơn giá (VND)' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AddServiceOrderDto.prototype, "unitPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, default: 1, description: 'Số lượng' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddServiceOrderDto.prototype, "quantity", void 0);
class CheckOutDto {
}
exports.CheckOutDto = CheckOutDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PaymentMethod, default: client_1.PaymentMethod.CASH, description: 'Phương thức thanh toán' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    __metadata("design:type", String)
], CheckOutDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, default: 0, description: 'Số tiền giảm giá (VND)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CheckOutDto.prototype, "discount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0.1, default: 0.1, description: 'Thuế VAT (0.1 = 10%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CheckOutDto.prototype, "taxRate", void 0);
//# sourceMappingURL=update-booking-status.dto.js.map