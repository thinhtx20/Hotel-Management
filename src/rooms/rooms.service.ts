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
import { SearchRoomDto } from './dto/search-room.dto';
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

    return room;
  }

  async findAll(status?: RoomStatus, floor?: number, roomTypeId?: string) {
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

  async findOne(id: string) {
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

    return room;
  }

  /**
   * Tìm kiếm phòng trống có tích hợp Redis Caching (TTL 60 giây)
   */
  async findAvailable(query: QueryAvailableRoomsDto) {
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

    // Lưu vào Redis cache trong 60 giây
    await this.redis.set(cacheKey, availableRooms, 60);

    return availableRooms;
  }

  /**
   * Tìm kiếm thông minh Full-Text Search qua Elasticsearch
   */
  async search(dto: SearchRoomDto) {
    if (this.esService.isReady) {
      const esResults = await this.esService.searchRooms(
        dto.q,
        dto.minPrice,
        dto.maxPrice,
        dto.amenities,
      );
      if (esResults.length > 0) {
        return esResults;
      }
    }

    // Fallback: Tìm kiếm trong PostgreSQL nếu ES chưa bật
    return this.prisma.room.findMany({
      where: {
        status: RoomStatus.AVAILABLE,
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

  async update(id: string, dto: UpdateRoomDto) {
    await this.findOne(id);
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

    return updated;
  }

  async updateStatus(id: string, status: RoomStatus) {
    await this.findOne(id);
    const updated = await this.prisma.room.update({
      where: { id },
      data: { status },
      include: { roomType: true },
    });

    await this.redis.delByPattern('cache:rooms:*');
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    const deleted = await this.prisma.room.delete({
      where: { id },
    });

    await this.redis.delByPattern('cache:rooms:*');
    await this.esService.removeRoom(id);

    return deleted;
  }
}
