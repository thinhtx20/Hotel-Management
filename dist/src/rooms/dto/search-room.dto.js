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
exports.SearchRoomDto = exports.RoomSortOption = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
var RoomSortOption;
(function (RoomSortOption) {
    RoomSortOption["PRICE_ASC"] = "PRICE_ASC";
    RoomSortOption["PRICE_DESC"] = "PRICE_DESC";
    RoomSortOption["FLOOR_DESC"] = "FLOOR_DESC";
})(RoomSortOption || (exports.RoomSortOption = RoomSortOption = {}));
class SearchRoomDto {
}
exports.SearchRoomDto = SearchRoomDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'view biển ban công', description: 'Từ khóa tìm kiếm (Tên phòng, mô tả, tiện nghi)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SearchRoomDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 500000, description: 'Giá thấp nhất (VND)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SearchRoomDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2000000, description: 'Giá cao nhất (VND)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SearchRoomDto.prototype, "maxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: ['Wifi', 'Bồn tắm'],
        type: [String],
        description: 'Lọc danh sách tiện ích yêu cầu (mảng hoặc chuỗi phân tách bởi dấu phẩy)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (Array.isArray(value))
            return value;
        if (typeof value === 'string')
            return value.split(',').map((s) => s.trim()).filter(Boolean);
        return value;
    }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SearchRoomDto.prototype, "amenities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: RoomSortOption,
        example: RoomSortOption.PRICE_ASC,
        description: 'Sắp xếp kết quả tìm kiếm (PRICE_ASC: Giá tăng dần, PRICE_DESC: Giá giảm dần, FLOOR_DESC: Tầng cao xuống)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(RoomSortOption),
    __metadata("design:type", String)
], SearchRoomDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, description: 'Lọc theo số tầng' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SearchRoomDto.prototype, "floor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: client_1.RoomStatus,
        example: client_1.RoomStatus.AVAILABLE,
        description: 'Lọc theo trạng thái phòng (mặc định không ép cứng AVAILABLE nếu không truyền)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.RoomStatus),
    __metadata("design:type", String)
], SearchRoomDto.prototype, "status", void 0);
//# sourceMappingURL=search-room.dto.js.map