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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../prisma/prisma.service");
const user_events_service_1 = require("./user-events.service");
let UsersService = class UsersService {
    constructor(prisma, userEvents) {
        this.prisma = prisma;
        this.userEvents = userEvents;
    }
    async create(dto) {
        const email = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new common_1.ConflictException('Email này đã được đăng ký trong hệ thống');
        }
        const hashedPassword = await bcrypt.hash(dto.password, await bcrypt.genSalt(10));
        const created = await this.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName: dto.fullName,
                phone: dto.phone,
                avatar: dto.avatar,
                role: dto.role,
                isActive: dto.isActive ?? true,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
        this.userEvents.emitCreated(created);
        return created;
    }
    async findAll(role) {
        return this.prisma.user.findMany({
            where: role ? { role } : undefined,
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                createdAt: true,
                _count: {
                    select: { bookings: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                createdAt: true,
                bookings: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        room: {
                            include: { roomType: true },
                        },
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException(`Không tìm thấy người dùng với ID: ${id}`);
        }
        return user;
    }
    async update(id, dto) {
        await this.findOne(id);
        const updated = await this.prisma.user.update({
            where: { id },
            data: dto,
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                updatedAt: true,
            },
        });
        this.userEvents.emitUpdated(updated);
        return updated;
    }
    async updateMe(id, dto) {
        await this.findOne(id);
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.fullName ? { fullName: dto.fullName } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        this.userEvents.emitUpdated(updated);
        return {
            ...updated,
            avatarUrl: updated.avatar,
        };
    }
    async remove(id) {
        await this.findOne(id);
        const deactivated = await this.prisma.user.update({
            where: { id },
            data: { isActive: false },
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        this.userEvents.emitDeactivated(deactivated);
        return deactivated;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        user_events_service_1.UserEventsService])
], UsersService);
//# sourceMappingURL=users.service.js.map