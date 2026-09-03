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
exports.CreateRoomDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class CreateRoomDto {
}
exports.CreateRoomDto = CreateRoomDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '101', description: 'Số phòng (duy nhất)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Số phòng không được để trống' }),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "roomNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Tầng' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateRoomDto.prototype, "floor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'uuid-room-type', description: 'ID của loại phòng' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Loại phòng là bắt buộc' }),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "roomTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.RoomStatus, default: client_1.RoomStatus.AVAILABLE }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.RoomStatus),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Cạnh thang máy, view nhìn ra sân vườn' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "notes", void 0);
//# sourceMappingURL=create-room.dto.js.map