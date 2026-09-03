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
exports.RecordPaymentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class RecordPaymentDto {
}
exports.RecordPaymentDto = RecordPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1500000, description: 'Số tiền thanh toán (VND)' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordPaymentDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.PaymentMethod, default: client_1.PaymentMethod.CASH, description: 'Phương thức thanh toán' }),
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PaymentStatus, default: client_1.PaymentStatus.PAID, description: 'Trạng thái thanh toán' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PaymentStatus),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "paymentStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Khách thanh toán quẹt thẻ POS Vietcombank', description: 'Ghi chú thu ngân' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "notes", void 0);
//# sourceMappingURL=record-payment.dto.js.map