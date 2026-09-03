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
exports.RoomTypesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let RoomTypesService = class RoomTypesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        const existing = await this.prisma.roomType.findFirst({
            where: {
                OR: [{ name: dto.name }, { code: dto.code.toUpperCase() }],
            },
        });
        if (existing) {
            throw new common_1.ConflictException('Tên hoặc mã loại phòng đã tồn tại');
        }
        return this.prisma.roomType.create({
            data: {
                ...dto,
                code: dto.code.toUpperCase(),
                amenities: dto.amenities || [],
                images: dto.images || [],
            },
        });
    }
    async findAll() {
        return this.prisma.roomType.findMany({
            include: {
                _count: {
                    select: { rooms: true },
                },
            },
            orderBy: { basePrice: 'asc' },
        });
    }
    async findOne(id) {
        const roomType = await this.prisma.roomType.findUnique({
            where: { id },
            include: {
                rooms: true,
            },
        });
        if (!roomType) {
            throw new common_1.NotFoundException(`Không tìm thấy loại phòng với ID: ${id}`);
        }
        return roomType;
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.roomType.update({
            where: { id },
            data: {
                ...dto,
                code: dto.code ? dto.code.toUpperCase() : undefined,
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.roomType.delete({
            where: { id },
        });
    }
};
exports.RoomTypesService = RoomTypesService;
exports.RoomTypesService = RoomTypesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoomTypesService);
//# sourceMappingURL=room-types.service.js.map