import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { QueryAvailableRoomsDto } from './dto/query-available-rooms.dto';
import { RoomSortOption, SearchRoomDto } from './dto/search-room.dto';
import { toRoomResponse } from './dto/room-response.dto';
import { BookingStatus, RoomStatus } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private esService: ElasticsearchService,
  ) {}

  async create(dto: CreateRoomDto) {
    const existing = await this.prisma.room.findUnique({
      where: { roomNumber: dto.roomNumber },
    });
    if (existing) {
      throw new ConflictException(`Số phòng ${dto.roomNumber} đã tồn tại`);
    }

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: dto.roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException(`Loại phòng ID ${dto.roomTypeId} không tồn tại`);
    }

    const room = await this.prisma.room.create({
      data: dto,
      include: { roomType: true },
    });

    // Invalidate Redis cache
    await this.redis.delByPattern('cache:rooms:*');

    // Sync to Elasticsearch
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

    return toRoomResponse(room, true);
  }

  async findAll(status?: RoomStatus, floor?: number, roomTypeId?: string, includeNotes = false) {
    const rooms = await this.prisma.room.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(floor ? { floor } : {}),
        ...(roomTypeId ? { roomTypeId } : {}),
      },
      include: {
        roomType: true,
        bookings: {
          where: { status: BookingStatus.CHECKED_IN },
          take: 1,
          include: { customer: { select: { fullName: true, phone: true } } },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    return rooms.map((r) => toRoomResponse(r, includeNotes));
  }

  async findOne(id: string, includeNotes = false) {
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
      throw new NotFoundException(`Không tìm thấy phòng với ID: ${id}`);
    }

    return toRoomResponse(room, includeNotes);
  }

  /**
   * Tìm kiếm phòng trống có tích hợp Redis Caching (TTL 60 giây)
   */
  async findAvailable(query: QueryAvailableRoomsDto, includeNotes = false) {
    const checkIn = new Date(query.checkInDate);
    const checkOut = new Date(query.checkOutDate);

    if (checkIn >= checkOut) {
      throw new BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
    }

    const cacheKey = `cache:rooms:available:${query.checkInDate}:${query.checkOutDate}:${query.guestCount || 0}:${query.roomTypeId || 'all'}`;
    const cachedData = await this.redis.get<any[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Lấy danh sách roomId đã bị đặt trong khoảng thời gian này
    const busyBookings = await this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
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
        status: { notIn: [RoomStatus.MAINTENANCE] },
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

    const mapped = availableRooms.map((r) => toRoomResponse(r, includeNotes));

    // Lưu vào Redis cache trong 60 giây
    await this.redis.set(cacheKey, mapped, 60);

    return mapped;
  }

  /**
   * Tìm kiếm thông minh Full-Text Search qua Elasticsearch với fallback PostgreSQL (BE-3, BE-7, BE-8)
   */
  async search(dto: SearchRoomDto, includeNotes = false) {
    if (this.esService.isReady) {
      const esRoomIds = await this.esService.searchRooms(
        dto.q,
        dto.minPrice,
        dto.maxPrice,
        dto.amenities,
        dto.floor,
        dto.status,
        dto.sort,
      );

      if (esRoomIds.length > 0) {
        // Hydrate lại từ Postgres theo đúng danh sách ID để có ảnh và tiện ích đầy đủ (BE-8)
        const rooms = await this.prisma.room.findMany({
          where: { id: { in: esRoomIds } },
          include: { roomType: true },
        });

        const roomMap = new Map(rooms.map((r) => [r.id, r]));
        return esRoomIds
          .map((id) => roomMap.get(id))
          .filter((r): r is (typeof rooms)[0] => !!r)
          .map((r) => toRoomResponse(r, includeNotes));
      }
    }

    // Fallback: Tìm kiếm trong PostgreSQL nếu ES chưa bật hoặc không có kết quả
    const where: any = {
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

    let orderBy: any[] = [{ floor: 'asc' }, { roomNumber: 'asc' }];
    if (dto.sort === RoomSortOption.PRICE_ASC) {
      orderBy = [{ roomType: { basePrice: 'asc' } }, { roomNumber: 'asc' }];
    } else if (dto.sort === RoomSortOption.PRICE_DESC) {
      orderBy = [{ roomType: { basePrice: 'desc' } }, { roomNumber: 'asc' }];
    } else if (dto.sort === RoomSortOption.FLOOR_DESC) {
      orderBy = [{ floor: 'desc' }, { roomNumber: 'asc' }];
    }

    const rooms = await this.prisma.room.findMany({
      where,
      include: { roomType: true },
      orderBy,
    });

    return rooms.map((r) => toRoomResponse(r, includeNotes));
  }

  async update(id: string, dto: UpdateRoomDto) {
    await this.findOne(id, true);
    const updated = await this.prisma.room.update({
      where: { id },
      data: dto,
      include: { roomType: true },
    });

    await this.redis.delByPattern('cache:rooms:*');

    // Update Elasticsearch
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

    return toRoomResponse(updated, true);
  }

  async updateStatus(id: string, status: RoomStatus) {
    await this.findOne(id, true);
    const updated = await this.prisma.room.update({
      where: { id },
      data: { status },
      include: { roomType: true },
    });

    await this.redis.delByPattern('cache:rooms:*');
    return toRoomResponse(updated, true);
  }

  async remove(id: string) {
    await this.findOne(id, true);
    const deleted = await this.prisma.room.delete({
      where: { id },
    });

    await this.redis.delByPattern('cache:rooms:*');
    await this.esService.removeRoom(id);

    return deleted;
  }
}
