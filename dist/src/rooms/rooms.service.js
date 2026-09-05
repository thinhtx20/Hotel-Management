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
const search_room_dto_1 = require("./dto/search-room.dto");
const room_response_dto_1 = require("./dto/room-response.dto");
const room_status_util_1 = require("../common/utils/room-status.util");
const client_1 = require("@prisma/client");
const room_events_service_1 = require("./room-events.service");
const pagination_util_1 = require("../common/utils/pagination.util");
let RoomsService = class RoomsService {
    constructor(prisma, redis, esService, roomEvents) {
        this.prisma = prisma;
        this.redis = redis;
        this.esService = esService;
        this.roomEvents = roomEvents;
    }
    async create(dto) {
        const existing = await this.prisma.room.findUnique({
            where: { roomNumber: dto.roomNumber },
        });
        if (existing) {
            throw new common_1.ConflictException(`Số phòng ${dto.roomNumber} đã tồn tại`);
        }
        let roomTypeId = dto.roomTypeId;
        if (!roomTypeId) {
            if (dto.roomTypeCode) {
                const found = await this.prisma.roomType.findUnique({
                    where: { code: dto.roomTypeCode },
                });
                if (found)
                    roomTypeId = found.id;
            }
            else if (dto.roomTypeName) {
                const found = await this.prisma.roomType.findUnique({
                    where: { name: dto.roomTypeName },
                });
                if (found)
                    roomTypeId = found.id;
            }
        }
        if (!roomTypeId) {
            const defaultType = await this.prisma.roomType.findFirst();
            if (defaultType) {
                roomTypeId = defaultType.id;
            }
            else {
                throw new common_1.NotFoundException('Vui lòng chọn hoặc cung cấp loại phòng hợp lệ');
            }
        }
        const roomType = await this.prisma.roomType.findUnique({
            where: { id: roomTypeId },
        });
        if (!roomType) {
            throw new common_1.NotFoundException(`Loại phòng ID ${roomTypeId} không tồn tại`);
        }
        const incomingImages = dto.images || (dto.imageUrl ? [dto.imageUrl] : dto.image ? [dto.image] : []);
        if (incomingImages.length > 0 ||
            (dto.amenities && dto.amenities.length > 0) ||
            dto.pricePerNight ||
            dto.price ||
            dto.basePrice ||
            dto.description) {
            const updateData = {};
            if (incomingImages.length > 0) {
                const combined = Array.from(new Set([...incomingImages, ...(roomType.images || [])]));
                updateData.images = combined;
            }
            if (dto.amenities && dto.amenities.length > 0) {
                const combined = Array.from(new Set([...dto.amenities, ...(roomType.amenities || [])]));
                updateData.amenities = combined;
            }
            const newPrice = dto.pricePerNight || dto.price || dto.basePrice;
            if (newPrice && newPrice > 0) {
                updateData.basePrice = Number(newPrice);
            }
            if (dto.description) {
                updateData.description = dto.description;
            }
            if (Object.keys(updateData).length > 0) {
                await this.prisma.roomType.update({
                    where: { id: roomTypeId },
                    data: updateData,
                });
                Object.assign(roomType, updateData);
            }
        }
        const room = await this.prisma.room.create({
            data: {
                roomNumber: dto.roomNumber,
                floor: Number(dto.floor),
                roomTypeId: roomTypeId,
                status: dto.status || client_1.RoomStatus.AVAILABLE,
                notes: dto.notes,
            },
            include: { roomType: true },
        });
        await this.redis.delByPattern('cache:rooms:*');
        await this.esService.indexRoomEntity(room);
        const roomPayload = {
            id: room.id,
            roomNumber: room.roomNumber,
            floor: room.floor,
            status: room.status,
            roomTypeId: room.roomTypeId,
            roomTypeName: room.roomType?.name,
            roomTypeCode: room.roomType?.code,
            pricePerNight: room.roomType?.basePrice,
            notes: room.notes,
            updatedAt: room.updatedAt,
        };
        this.roomEvents.emitCreated(roomPayload);
        this.roomEvents.emitStatusChanged(roomPayload);
        return (0, room_response_dto_1.toRoomResponse)(room, true);
    }
    async findAll(queryOrStatus, floorParam, roomTypeIdParam, isStaffParam = false) {
        let query;
        let isStaff = isStaffParam;
        if (queryOrStatus && typeof queryOrStatus === 'object') {
            query = queryOrStatus;
            if (typeof floorParam === 'boolean') {
                isStaff = floorParam;
            }
        }
        else {
            query = {
                status: queryOrStatus,
                floor: typeof floorParam === 'number' ? floorParam : undefined,
                roomTypeId: roomTypeIdParam,
            };
        }
        const internalStatuses = [
            client_1.RoomStatus.PENDING_APPROVAL,
            client_1.RoomStatus.REJECTED,
        ];
        const isInternalStatus = query.status ? internalStatuses.includes(query.status) : false;
        if (!isStaff && isInternalStatus) {
            return (0, pagination_util_1.buildPaginatedResult)([], 0, query.page, query.limit);
        }
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(!isStaff && !query.status ? { status: { notIn: internalStatuses } } : {}),
            ...(query.floor ? { floor: query.floor } : {}),
            ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
        };
        if (query.search) {
            const search = query.search.trim();
            const insensitive = 'insensitive';
            where.OR = [
                { roomNumber: { contains: search, mode: insensitive } },
                { roomType: { name: { contains: search, mode: insensitive } } },
            ];
        }
        const { isPaginated, page, limit, skip, take } = (0, pagination_util_1.calculatePagination)(query);
        const [total, rooms] = await this.prisma.$transaction([
            this.prisma.room.count({ where }),
            this.prisma.room.findMany({
                where,
                include: {
                    roomType: true,
                    bookings: {
                        where: { status: { in: [client_1.BookingStatus.CHECKED_IN, client_1.BookingStatus.CONFIRMED] } },
                        orderBy: { checkInDate: 'asc' },
                        take: 2,
                        include: { customer: { select: { fullName: true, phone: true } } },
                    },
                },
                orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
                ...(isPaginated ? { skip, take } : {}),
            }),
        ]);
        const data = rooms.map((r) => (0, room_response_dto_1.toRoomResponse)(r, isStaff));
        return (0, pagination_util_1.buildPaginatedResult)(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
    }
    async findOne(id, includeNotes = false) {
        const room = await this.prisma.room.findUnique({
            where: { id },
            include: {
                roomType: true,
                bookings: {
                    where: { status: { in: [client_1.BookingStatus.CHECKED_IN, client_1.BookingStatus.CONFIRMED] } },
                    orderBy: { checkInDate: 'asc' },
                    take: 5,
                    include: { customer: { select: { fullName: true, phone: true } } },
                },
            },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Không tìm thấy phòng với ID: ${id}`);
        }
        return (0, room_response_dto_1.toRoomResponse)(room, includeNotes);
    }
    async findAvailable(query, includeNotes = false) {
        const rawCheckIn = new Date(query.checkInDate);
        const rawCheckOut = new Date(query.checkOutDate);
        if (rawCheckIn >= rawCheckOut) {
            throw new common_1.BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
        }
        const checkIn = new Date(rawCheckIn);
        checkIn.setUTCHours(14, 0, 0, 0);
        const checkOut = new Date(rawCheckOut);
        checkOut.setUTCHours(12, 0, 0, 0);
        const cacheKey = `cache:rooms:available:${query.checkInDate}:${query.checkOutDate}:${query.guestCount || 0}:${query.roomTypeId || 'all'}`;
        const cachedData = await this.redis.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }
        const now = new Date();
        const busyBookings = await this.prisma.booking.findMany({
            where: {
                status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
                checkOutDate: { gt: now },
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
                status: { notIn: [client_1.RoomStatus.MAINTENANCE, client_1.RoomStatus.PENDING_APPROVAL, client_1.RoomStatus.REJECTED] },
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
        const mapped = availableRooms.map((r) => (0, room_response_dto_1.toRoomResponse)(r, includeNotes));
        await this.redis.set(cacheKey, mapped, 60);
        return mapped;
    }
    async search(dto, includeNotes = false) {
        if (this.esService.isReady) {
            const esRoomIds = await this.esService.searchRooms(dto.q, dto.minPrice, dto.maxPrice, dto.amenities, dto.floor, dto.status, dto.sort);
            if (esRoomIds.length > 0) {
                const rooms = await this.prisma.room.findMany({
                    where: { id: { in: esRoomIds } },
                    include: { roomType: true },
                });
                const roomMap = new Map(rooms.map((r) => [r.id, r]));
                return esRoomIds
                    .map((id) => roomMap.get(id))
                    .filter((r) => !!r)
                    .map((r) => (0, room_response_dto_1.toRoomResponse)(r, includeNotes));
            }
        }
        const where = {
            ...(dto.status ? { status: dto.status } : {}),
            ...(dto.floor ? { floor: dto.floor } : {}),
            roomType: {
                ...(dto.minPrice ? { basePrice: { gte: dto.minPrice } } : {}),
                ...(dto.maxPrice ? { basePrice: { lte: dto.maxPrice } } : {}),
                ...(dto.amenities && dto.amenities.length > 0
                    ? { amenities: { hasEvery: dto.amenities } }
                    : {}),
                ...(dto.q
                    ? {
                        OR: [
                            { name: { contains: dto.q, mode: 'insensitive' } },
                            { description: { contains: dto.q, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
        };
        let orderBy = [{ floor: 'asc' }, { roomNumber: 'asc' }];
        if (dto.sort === search_room_dto_1.RoomSortOption.PRICE_ASC) {
            orderBy = [{ roomType: { basePrice: 'asc' } }, { roomNumber: 'asc' }];
        }
        else if (dto.sort === search_room_dto_1.RoomSortOption.PRICE_DESC) {
            orderBy = [{ roomType: { basePrice: 'desc' } }, { roomNumber: 'asc' }];
        }
        else if (dto.sort === search_room_dto_1.RoomSortOption.FLOOR_DESC) {
            orderBy = [{ floor: 'desc' }, { roomNumber: 'asc' }];
        }
        const rooms = await this.prisma.room.findMany({
            where,
            include: { roomType: true },
            orderBy,
        });
        return rooms.map((r) => (0, room_response_dto_1.toRoomResponse)(r, includeNotes));
    }
    async update(id, dto) {
        const existing = await this.findOne(id, true);
        const updated = await this.prisma.room.update({
            where: { id },
            data: dto,
            include: { roomType: true },
        });
        await this.redis.delByPattern('cache:rooms:*');
        await this.esService.indexRoomEntity(updated);
        const payload = {
            id: updated.id,
            roomNumber: updated.roomNumber,
            floor: updated.floor,
            status: updated.status,
            previousStatus: existing.status,
            roomTypeId: updated.roomTypeId,
            roomTypeName: updated.roomType?.name,
            roomTypeCode: updated.roomType?.code,
            pricePerNight: updated.roomType?.basePrice,
            notes: updated.notes,
            updatedAt: updated.updatedAt,
        };
        if (existing.status !== updated.status) {
            this.roomEvents.emitStatusChanged(payload);
        }
        this.roomEvents.emitUpdated(payload);
        return (0, room_response_dto_1.toRoomResponse)(updated, true);
    }
    async syncAllStatuses() {
        const rooms = await this.prisma.room.findMany({
            include: {
                roomType: true,
                bookings: {
                    where: { status: { in: [client_1.BookingStatus.CHECKED_IN, client_1.BookingStatus.CONFIRMED] } },
                    select: { status: true, checkInDate: true, checkOutDate: true },
                },
            },
            orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
        });
        const now = new Date();
        const changes = [];
        for (const room of rooms) {
            const next = (0, room_status_util_1.deriveRoomStatus)(room.status, room.bookings, now);
            if (next !== room.status) {
                const updated = await this.prisma.room.update({
                    where: { id: room.id },
                    data: { status: next },
                    include: { roomType: true },
                });
                await this.esService.indexRoomEntity({ ...room, status: next });
                changes.push({ roomNumber: room.roomNumber, from: room.status, to: next });
                this.roomEvents.emitStatusChanged({
                    id: updated.id,
                    roomNumber: updated.roomNumber,
                    floor: updated.floor,
                    status: updated.status,
                    previousStatus: room.status,
                    roomTypeId: updated.roomTypeId,
                    roomTypeName: updated.roomType?.name,
                    roomTypeCode: updated.roomType?.code,
                    pricePerNight: updated.roomType?.basePrice,
                    notes: updated.notes,
                    updatedAt: updated.updatedAt,
                });
            }
        }
        if (changes.length > 0) {
            await this.redis.delByPattern('cache:rooms:*');
        }
        return {
            message: changes.length > 0
                ? `Đã đồng bộ lại trạng thái cho ${changes.length}/${rooms.length} phòng`
                : `Toàn bộ ${rooms.length} phòng đã khớp với lịch đặt phòng, không cần thay đổi`,
            totalRooms: rooms.length,
            updatedCount: changes.length,
            changes,
        };
    }
    async updateStatus(id, status) {
        const existing = await this.findOne(id, true);
        const updated = await this.prisma.room.update({
            where: { id },
            data: { status },
            include: { roomType: true },
        });
        await this.redis.delByPattern('cache:rooms:*');
        await this.esService.indexRoomEntity(updated);
        this.roomEvents.emitStatusChanged({
            id: updated.id,
            roomNumber: updated.roomNumber,
            floor: updated.floor,
            status: updated.status,
            previousStatus: existing.status,
            roomTypeId: updated.roomTypeId,
            roomTypeName: updated.roomType?.name,
            roomTypeCode: updated.roomType?.code,
            pricePerNight: updated.roomType?.basePrice,
            notes: updated.notes,
            updatedAt: updated.updatedAt,
        });
        return (0, room_response_dto_1.toRoomResponse)(updated, true);
    }
    async remove(id) {
        const existing = await this.findOne(id, true);
        const deleted = await this.prisma.room.delete({
            where: { id },
        });
        await this.redis.delByPattern('cache:rooms:*');
        await this.esService.removeRoom(id);
        this.roomEvents.emitDeleted(existing.id, existing.roomNumber);
        return deleted;
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        elasticsearch_service_1.ElasticsearchService,
        room_events_service_1.RoomEventsService])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map