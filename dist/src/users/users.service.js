"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const user_events_service_1 = require("./user-events.service");
const pagination_util_1 = require("../common/utils/pagination.util");
let UsersService = class UsersService {
    constructor(prisma, userEvents) {
        this.prisma = prisma;
        this.userEvents = userEvents;
    }
    async create(dto) {
        const email = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new common_1.ConflictException('Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½ trong há»‡ thá»‘ng');
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
    async findAll(queryOrRole) {
        const query = typeof queryOrRole === 'string'
            ? { role: queryOrRole }
            : (queryOrRole ?? {});
        const where = {};
        if (query.role) {
            where.role = query.role;
        }
        if (query.search) {
            const search = query.search.trim();
            const insensitive = 'insensitive';
            where.OR = [
                { fullName: { contains: search, mode: insensitive } },
                { email: { contains: search, mode: insensitive } },
                { phone: { contains: search, mode: insensitive } },
            ];
        }
        const { isPaginated, page, limit, skip, take } = (0, pagination_util_1.calculatePagination)(query);
        const [total, list] = await this.prisma.$transaction([
            this.prisma.user.count({ where }),
            this.prisma.user.findMany({
                where,
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
                ...(isPaginated ? { skip, take } : {}),
            }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(list, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
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
            throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng vá»›i ID: ${id}`);
        }
        return user;
    }
    async update(id, dto) {
        await this.findOne(id);
        const data = { ...dto };
        if (data.password) {
            data.password = await bcrypt.hash(data.password, await bcrypt.genSalt(10));
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data,
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
    async adminChangePassword(id, dto) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException(`KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng vá»›i ID: ${id}`);
        }
        const newPassword = dto.newPassword || dto.password;
        if (!newPassword || newPassword.trim().length < 6) {
            throw new common_1.BadRequestException('Máº­t kháº©u má»›i pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±');
        }
        const hashedPassword = await bcrypt.hash(newPassword.trim(), await bcrypt.genSalt(10));
        await this.prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });
        return {
            success: true,
            message: `ÄÃ£ Ä‘á»•i máº­t kháº©u cho tÃ i khoáº£n ${user.fullName || user.email} thÃ nh cÃ´ng`,
        };
    }
    async updateMe(id, dto) {
        await this.findOne(id);
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.fullName ? { fullName: dto.fullName } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
                ...(dto.fcmToken !== undefined ? { fcmToken: dto.fcmToken } : {}),
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
    async updateFcmToken(userId, fcmToken) {
        await this.findOne(userId);
        await this.prisma.user.update({
            where: { id: userId },
            data: { fcmToken },
        });
        return { message: 'Cập nhật FCM token thành công', fcmToken };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        user_events_service_1.UserEventsService])
], UsersService);
//# sourceMappingURL=users.service.js.map