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
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const elasticsearch_service_1 = require("../elasticsearch/elasticsearch.service");
const client_1 = require("@prisma/client");
let RoomsService = class RoomsService {
    constructor(prisma, redis, esService) {
        this.prisma = prisma;
        this.redis = redis;
        this.esService = esService;
    }
    async create(dto) {
        const existing = await this.prisma.room.findUnique({
            where: { roomNumber: dto.roomNumber },
        });
        if (existing) {
            throw new common_1.ConflictException(`Số phòng ${dto.roomNumber} đã tồn tại`);
        }
        const roomType = await this.prisma.roomType.findUnique({
            where: { id: dto.roomTypeId },
        });
        if (!roomType) {
            throw new common_1.NotFoundException(`Loại phòng ID ${dto.roomTypeId} không tồn tại`);
        }
        const room = await this.prisma.room.create({
            data: dto,
            include: { roomType: true },
        });
        await this.redis.delByPattern('cache:rooms:*');
        await this.esService.indexRoom({
            id: room.id,
            roomNumber: room.roomNumber,
            floor: room.floor,
            status: room.status,
            roomTypeId: room.roomTypeId,
            roomTypeName: room.roomType.name,
            code: room.roomType.code,
            description: room.roomType.description || '',
            basePrice: room.roomType.basePrice,
            capacityAdults: room.roomType.capacityAdults,
            capacityChildren: room.roomType.capacityChildren,
            amenities: room.roomType.amenities,
        });
        return room;
    }
    async findAll(status, floor, roomTypeId) {
        return this.prisma.room.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(floor ? { floor } : {}),
                ...(roomTypeId ? { roomTypeId } : {}),
            },
            include: {
                roomType: true,
            },
            orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
        });
    }
    async findOne(id) {
        const room = await this.prisma.room.findUnique({
            where: { id },
            include: {
                roomType: true,
                bookings: {
                    take: 5,
                    orderBy: { checkInDate: 'desc' },
                    include: { customer: { select: { fullName: true, phone: true } } },
                },
            },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Không tìm thấy phòng với ID: ${id}`);
        }
        return room;
    }
    async findAvailable(query) {
        const checkIn = new Date(query.checkInDate);
        const checkOut = new Date(query.checkOutDate);
        if (checkIn >= checkOut) {
            throw new common_1.BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
        }
        const cacheKey = `cache:rooms:available:${query.checkInDate}:${query.checkOutDate}:${query.guestCount || 0}:${query.roomTypeId || 'all'}`;
        const cachedData = await this.redis.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }
        const busyBookings = await this.prisma.booking.findMany({
            where: {
                status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
                AND: [
                    { checkInDate: { lt: checkOut } },
                    { checkOutDate: { gt: checkIn } },
                ],
            },
            select: { roomId: true },
        });
        const busyRoomIds = busyBookings.map((b) => b.roomId);
        const availableRooms = await this.prisma.room.findMany({
            where: {
                id: { notIn: busyRoomIds },
                status: { notIn: [client_1.RoomStatus.MAINTENANCE] },
                ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
                roomType: query.guestCount
                    ? {
                        capacityAdults: { gte: Math.min(query.guestCount, 2) },
                    }
                    : undefined,
            },
            include: {
                roomType: true,
            },
            orderBy: { roomNumber: 'asc' },
        });
        await this.redis.set(cacheKey, availableRooms, 60);
        return availableRooms;
    }
    async search(dto) {
        if (this.esService.isReady) {
            const esResults = await this.esService.searchRooms(dto.q, dto.minPrice, dto.maxPrice, dto.amenities);
            if (esResults.length > 0) {
                return esResults;
            }
        }
        return this.prisma.room.findMany({
            where: {
                status: client_1.RoomStatus.AVAILABLE,
                roomType: {
                    ...(dto.minPrice ? { basePrice: { gte: dto.minPrice } } : {}),
                    ...(dto.maxPrice ? { basePrice: { lte: dto.maxPrice } } : {}),
                    ...(dto.q
                        ? {
                            OR: [
                                { name: { contains: dto.q, mode: 'insensitive' } },
                                { description: { contains: dto.q, mode: 'insensitive' } },
                            ],
                        }
                        : {}),
                },
            },
            include: { roomType: true },
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        const updated = await this.prisma.room.update({
            where: { id },
            data: dto,
            include: { roomType: true },
        });
        await this.redis.delByPattern('cache:rooms:*');
        await this.esService.indexRoom({
            id: updated.id,
            roomNumber: updated.roomNumber,
            floor: updated.floor,
            status: updated.status,
            roomTypeId: updated.roomTypeId,
            roomTypeName: updated.roomType.name,
            code: updated.roomType.code,
            description: updated.roomType.description || '',
            basePrice: updated.roomType.basePrice,
            capacityAdults: updated.roomType.capacityAdults,
            capacityChildren: updated.roomType.capacityChildren,
            amenities: updated.roomType.amenities,
        });
        return updated;
    }
    async updateStatus(id, status) {
        await this.findOne(id);
        const updated = await this.prisma.room.update({
            where: { id },
            data: { status },
            include: { roomType: true },
        });
        await this.redis.delByPattern('cache:rooms:*');
        return updated;
    }
    async remove(id) {
        await this.findOne(id);
        const deleted = await this.prisma.room.delete({
            where: { id },
        });
        await this.redis.delByPattern('cache:rooms:*');
        await this.esService.removeRoom(id);
        return deleted;
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        elasticsearch_service_1.ElasticsearchService])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map