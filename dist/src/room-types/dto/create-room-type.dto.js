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
exports.CreateRoomTypeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateRoomTypeDto {
}
exports.CreateRoomTypeDto = CreateRoomTypeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Phòng Deluxe Hướng Biển', description: 'Tên loại phòng' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Tên loại phòng không được để trống' }),
    __metadata("design:type", String)
], CreateRoomTypeDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DLX-OCEAN', description: 'Mã loại phòng độc nhất' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Mã loại phòng không được để trống' }),
    __metadata("design:type", String)
], CreateRoomTypeDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Phòng cao cấp ban công view biển, bồn tắm nằm' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRoomTypeDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1500000, description: 'Giá cơ bản một đêm (VND)' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0, { message: 'Giá phòng không được âm' }),
    __metadata("design:type", Number)
], CreateRoomTypeDto.prototype, "basePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, default: 2, description: 'Số người lớn tối đa' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateRoomTypeDto.prototype, "capacityAdults", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, default: 1, description: 'Số trẻ em tối đa' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRoomTypeDto.prototype, "capacityChildren", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 42.5, description: 'Diện tích (m2)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateRoomTypeDto.prototype, "sizeSqM", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: ['Wifi', 'Smart TV 55 inch', 'Bồn tắm', 'Minibar', 'Ban công'],
        type: [String],
        description: 'Danh sách tiện ích',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateRoomTypeDto.prototype, "amenities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b'],
        type: [String],
        description: 'Danh sách link ảnh phòng',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateRoomTypeDto.prototype, "images", void 0);
//# sourceMappingURL=create-room-type.dto.js.map