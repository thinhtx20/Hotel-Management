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
import { deriveRoomStatus } from '../common/utils/room-status.util';
import { BookingStatus, RoomStatus } from '@prisma/client';
import { RoomEventsService } from './room-events.service';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private esService: ElasticsearchService,
    private roomEvents: RoomEventsService,
  ) {}

  async create(dto: CreateRoomDto) {
    const existing = await this.prisma.room.findUnique({
      where: { roomNumber: dto.roomNumber },
    });
    if (existing) {
      throw new ConflictException(`Số phòng ${dto.roomNumber} đã tồn tại`);
    }

    let roomTypeId = dto.roomTypeId;
    if (!roomTypeId) {
      if (dto.roomTypeCode) {
        const found = await this.prisma.roomType.findUnique({
          where: { code: dto.roomTypeCode },
        });
        if (found) roomTypeId = found.id;
      } else if (dto.roomTypeName) {
        const found = await this.prisma.roomType.findUnique({
          where: { name: dto.roomTypeName },
        });
        if (found) roomTypeId = found.id;
      }
    }

    if (!roomTypeId) {
      const defaultType = await this.prisma.roomType.findFirst();
      if (defaultType) {
        roomTypeId = defaultType.id;
      } else {
        throw new NotFoundException('Vui lòng chọn hoặc cung cấp loại phòng hợp lệ');
      }
    }

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException(`Loại phòng ID ${roomTypeId} không tồn tại`);
    }

    // Nếu client gửi kèm ảnh, tiện ích, giá phòng hoặc mô tả mới
    const incomingImages =
      dto.images || (dto.imageUrl ? [dto.imageUrl] : dto.image ? [dto.image] : []);
    if (
      incomingImages.length > 0 ||
      (dto.amenities && dto.amenities.length > 0) ||
      dto.pricePerNight ||
      dto.price ||
      dto.basePrice ||
      dto.description
    ) {
      const updateData: any = {};
      if (incomingImages.length > 0) {
        const combined = Array.from(
          new Set([...incomingImages, ...(roomType.images || [])]),
        );
        updateData.images = combined;
      }
      if (dto.amenities && dto.amenities.length > 0) {
        const combined = Array.from(
          new Set([...dto.amenities, ...(roomType.amenities || [])]),
        );
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
        status: dto.status || RoomStatus.AVAILABLE,
        notes: dto.notes,
      },
      include: { roomType: true },
    });

    // Invalidate Redis cache
    await this.redis.delByPattern('cache:rooms:*');

    // Sync to Elasticsearch
    await this.esService.indexRoomEntity(room);

    // Phát sự kiện realtime
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

    return toRoomResponse(room, true);
  }

  async findAll(status?: RoomStatus, floor?: number, roomTypeId?: string, isStaff = false) {
    // Phòng chờ duyệt / bị từ chối là dữ liệu vận hành nội bộ:
    // khách hàng và khách vãng lai không được thấy trên sơ đồ phòng.
    const internalStatuses: RoomStatus[] = [
      RoomStatus.PENDING_APPROVAL,
      RoomStatus.REJECTED,
    ];
    const isInternalStatus = status ? internalStatuses.includes(status) : false;

    if (!isStaff && isInternalStatus) {
      return [];
    }

    const rooms = await this.prisma.room.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(!isStaff && !status ? { status: { notIn: internalStatuses } } : {}),
        ...(floor ? { floor } : {}),
        ...(roomTypeId ? { roomTypeId } : {}),
      },
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
          orderBy: { checkInDate: 'asc' },
          take: 2,
          include: { customer: { select: { fullName: true, phone: true } } },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    return rooms.map((r) => toRoomResponse(r, isStaff));
  }

  async findOne(id: string, includeNotes = false) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
          orderBy: { checkInDate: 'asc' },
          take: 5,
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
    const rawCheckIn = new Date(query.checkInDate);
    const rawCheckOut = new Date(query.checkOutDate);

    if (rawCheckIn >= rawCheckOut) {
      throw new BadRequestException('Ngày nhận phòng phải trước ngày trả phòng');
    }

    // Chuẩn hóa giờ nhận phòng (14:00 UTC) và giờ trả phòng (12:00 UTC) tiêu chuẩn khách sạn
    // Để khách trả phòng lúc 12:00 không làm xung đột khách mới nhận phòng lúc 14:00 cùng ngày
    const checkIn = new Date(rawCheckIn);
    checkIn.setUTCHours(14, 0, 0, 0);

    const checkOut = new Date(rawCheckOut);
    checkOut.setUTCHours(12, 0, 0, 0);

    const cacheKey = `cache:rooms:available:${query.checkInDate}:${query.checkOutDate}:${query.guestCount || 0}:${query.roomTypeId || 'all'}`;
    const cachedData = await this.redis.get<any[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const now = new Date();

    // Lấy danh sách roomId đã bị đặt trong khoảng thời gian này
    // Bao gồm cả PENDING (chờ duyệt), CONFIRMED (đã duyệt) và CHECKED_IN (đang ở)
    // Bỏ qua các đơn quá hạn trả phòng trong quá khứ
    const busyBookings = await this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
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
        status: { notIn: [RoomStatus.MAINTENANCE, RoomStatus.PENDING_APPROVAL, RoomStatus.REJECTED] },
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
    const existing = await this.findOne(id, true);
    const updated = await this.prisma.room.update({
      where: { id },
      data: dto,
      include: { roomType: true },
    });

    await this.redis.delByPattern('cache:rooms:*');

    // Update Elasticsearch
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

    return toRoomResponse(updated, true);
  }

  /**
   * Rà soát và đồng bộ lại trạng thái của toàn bộ phòng theo lịch đặt phòng thực tế.
   * Dùng để chữa dữ liệu đã lệch (phòng OCCUPIED nhưng không có đơn CHECKED_IN nào)
   * khiến ma trận phòng của lễ tân hiện "Có khách" mà không có khách.
   * Phòng đang MAINTENANCE / PENDING_APPROVAL / REJECTED được giữ nguyên.
   */
  async syncAllStatuses() {
    const rooms = await this.prisma.room.findMany({
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
          select: { status: true, checkOutDate: true },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    const now = new Date();
    const changes: Array<{ roomNumber: string; from: RoomStatus; to: RoomStatus }> = [];

    for (const room of rooms) {
      const next = deriveRoomStatus(room.status, room.bookings, now);
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
      message:
        changes.length > 0
          ? `Đã đồng bộ lại trạng thái cho ${changes.length}/${rooms.length} phòng`
          : `Toàn bộ ${rooms.length} phòng đã khớp với lịch đặt phòng, không cần thay đổi`,
      totalRooms: rooms.length,
      updatedCount: changes.length,
      changes,
    };
  }

  async updateStatus(id: string, status: RoomStatus) {
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

    return toRoomResponse(updated, true);
  }

  async remove(id: string) {
    const existing = await this.findOne(id, true);
    const deleted = await this.prisma.room.delete({
      where: { id },
    });

    await this.redis.delByPattern('cache:rooms:*');
    await this.esService.removeRoom(id);

    this.roomEvents.emitDeleted(existing.id, existing.roomNumber);

    return deleted;
  }
}
