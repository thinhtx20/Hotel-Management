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
import { QueryRoomsDto } from './dto/query-rooms.dto';
import { toRoomResponse } from './dto/room-response.dto';
import { deriveRoomStatus } from '../common/utils/room-status.util';
import { BookingStatus, Prisma, RoomStatus } from '@prisma/client';
import { RoomEventsService } from './room-events.service';
import { buildPaginatedResult, calculatePagination } from '../common/utils/pagination.util';

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
      throw new ConflictException(`S? phòng ${dto.roomNumber} dã t?n t?i`);
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
        throw new NotFoundException('Vui lòng ch?n ho?c cung c?p lo?i phòng h?p l?');
      }
    }

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException(`Lo?i phòng ID ${roomTypeId} không t?n t?i`);
    }

    // N?u client g?i kèm ?nh, ti?n ích, giá phòng ho?c mô t? m?i
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

    // Phát s? ki?n realtime
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

  async findAll(
    queryOrStatus?: QueryRoomsDto | RoomStatus,
    floorParam?: number | boolean,
    roomTypeIdParam?: string,
    isStaffParam = false,
  ) {
    let query: QueryRoomsDto;
    let isStaff = isStaffParam;

    if (queryOrStatus && typeof queryOrStatus === 'object') {
      query = queryOrStatus;
      if (typeof floorParam === 'boolean') {
        isStaff = floorParam;
      }
    } else {
      query = {
        status: queryOrStatus as RoomStatus | undefined,
        floor: typeof floorParam === 'number' ? floorParam : undefined,
        roomTypeId: roomTypeIdParam,
      };
    }

    // Phòng ch? duy?t / b? t? ch?i là d? li?u v?n hành n?i b?:
    // khách hàng và khách vãng lai không du?c th?y trên so d? phòng.
    const internalStatuses: RoomStatus[] = [
      RoomStatus.PENDING_APPROVAL,
      RoomStatus.REJECTED,
    ];
    const isInternalStatus = query.status ? internalStatuses.includes(query.status) : false;

    if (!isStaff && isInternalStatus) {
      return buildPaginatedResult([], 0, query.page, query.limit);
    }

    const where: Prisma.RoomWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(!isStaff && !query.status ? { status: { notIn: internalStatuses } } : {}),
      ...(query.floor ? { floor: query.floor } : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
    };

    if (query.search) {
      const search = query.search.trim();
      const insensitive = 'insensitive' as const;
      where.OR = [
        { roomNumber: { contains: search, mode: insensitive } },
        { roomType: { name: { contains: search, mode: insensitive } } },
      ];
    }

    const cacheKey = `cache:rooms:list:${JSON.stringify(query)}:${isStaff}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const { isPaginated, page, limit, skip, take } = calculatePagination(query);

    const [total, rooms] = await this.prisma.$transaction([
      this.prisma.room.count({ where }),
      this.prisma.room.findMany({
        where,
        include: {
          roomType: true,
          bookings: {
            where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
            orderBy: { checkInDate: 'asc' },
            take: 2,
            ...(isStaff
              ? { include: { customer: { select: { fullName: true, phone: true } } } }
              : { select: { status: true, checkInDate: true, checkOutDate: true, bookingCode: true } }),
          },
        },
        orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
        ...(isPaginated ? { skip, take } : {}),
      }),
    ]);

    const data = rooms.map((r) => toRoomResponse(r, isStaff));
    const result = buildPaginatedResult(data, total, isPaginated ? page : undefined, isPaginated ? limit : undefined);
    
    // Luu cache 60 giây (t? d?ng xóa khi có thay d?i tr?ng thái phòng ho?c don d?t phòng)
    await this.redis.set(cacheKey, result, 60);

    return result;
  }

  async findOne(id: string, includeNotes = false) {
    const cacheKey = `cache:rooms:detail:${id}:${includeNotes}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
          orderBy: { checkInDate: 'asc' },
          take: 5,
          ...(includeNotes
            ? { include: { customer: { select: { fullName: true, phone: true } } } }
            : { select: { status: true, checkInDate: true, checkOutDate: true, bookingCode: true } }),
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Không tìm th?y phòng v?i ID: ${id}`);
    }

    const result = toRoomResponse(room, includeNotes);
    await this.redis.set(cacheKey, result, 60);
    return result;
  }

  /**
   * Tìm ki?m phòng tr?ng có tích h?p Redis Caching (TTL 60 giây)
   */
  async findAvailable(query: QueryAvailableRoomsDto, includeNotes = false) {
    const rawCheckIn = new Date(query.checkInDate);
    const rawCheckOut = new Date(query.checkOutDate);

    if (rawCheckIn >= rawCheckOut) {
      throw new BadRequestException('Ngày nh?n phòng ph?i tru?c ngày tr? phòng');
    }

    // Chu?n hóa gi? nh?n phòng (14:00 UTC) và gi? tr? phòng (12:00 UTC) tiêu chu?n khách s?n
    // Ð? khách tr? phòng lúc 12:00 không làm xung d?t khách m?i nh?n phòng lúc 14:00 cùng ngày
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

    // L?y danh sách roomId dã b? d?t trong kho?ng th?i gian này
    // Bao g?m c? PENDING (ch? duy?t), CONFIRMED (dã duy?t) và CHECKED_IN (dang ?)
    // B? qua các don quá h?n tr? phòng trong quá kh?
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

    // Luu vào Redis cache trong 60 giây
    await this.redis.set(cacheKey, mapped, 60);

    return mapped;
  }

  /**
   * Tìm ki?m thông minh Full-Text Search qua Elasticsearch v?i fallback PostgreSQL (BE-3, BE-7, BE-8)
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
        // Hydrate l?i t? Postgres theo dúng danh sách ID d? có ?nh và ti?n ích d?y d? (BE-8)
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

    // Fallback: Tìm ki?m trong PostgreSQL n?u ES chua b?t ho?c không có k?t qu?
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

    // 1. Ki?m tra n?u d?i roomNumber thì không du?c trùng v?i phòng khác
    if (dto.roomNumber && dto.roomNumber !== existing.roomNumber) {
      const duplicate = await this.prisma.room.findUnique({
        where: { roomNumber: dto.roomNumber },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(`S? phòng ${dto.roomNumber} dã t?n t?i`);
      }
    }

    // 2. Xác d?nh và ki?m tra roomTypeId n?u có d?i lo?i phòng
    let targetRoomTypeId = dto.roomTypeId;
    if (!targetRoomTypeId) {
      if (dto.roomTypeCode) {
        const found = await this.prisma.roomType.findUnique({
          where: { code: dto.roomTypeCode },
        });
        if (found) targetRoomTypeId = found.id;
      } else if (dto.roomTypeName) {
        const found = await this.prisma.roomType.findUnique({
          where: { name: dto.roomTypeName },
        });
        if (found) targetRoomTypeId = found.id;
      }
    }

    if (targetRoomTypeId) {
      const roomTypeExists = await this.prisma.roomType.findUnique({
        where: { id: targetRoomTypeId },
      });
      if (!roomTypeExists) {
        throw new NotFoundException(`Lo?i phòng ID ${targetRoomTypeId} không t?n t?i`);
      }
    }

    // 3. C?p nh?t thông tin b? sung cho RoomType (giá, ?nh, ti?n ích, mô t?, s?c ch?a, v.v.) n?u du?c truy?n
    const effectiveRoomTypeId = targetRoomTypeId || existing.roomTypeId;
    const incomingImages =
      dto.images || (dto.imageUrl ? [dto.imageUrl] : dto.image ? [dto.image] : undefined);
    const newPrice = dto.pricePerNight ?? dto.price ?? dto.basePrice;

    if (
      incomingImages !== undefined ||
      dto.amenities !== undefined ||
      newPrice !== undefined ||
      dto.description !== undefined ||
      dto.sizeSqM !== undefined ||
      dto.capacityAdults !== undefined ||
      dto.capacityChildren !== undefined
    ) {
      const roomTypeUpdateData: Prisma.RoomTypeUpdateInput = {};
      if (incomingImages !== undefined) {
        roomTypeUpdateData.images = incomingImages;
      }
      if (dto.amenities !== undefined) {
        roomTypeUpdateData.amenities = dto.amenities;
      }
      if (newPrice !== undefined && Number(newPrice) > 0) {
        roomTypeUpdateData.basePrice = Number(newPrice);
      }
      if (dto.description !== undefined) {
        roomTypeUpdateData.description = dto.description;
      }
      if (dto.sizeSqM !== undefined) {
        roomTypeUpdateData.sizeSqM = Number(dto.sizeSqM);
      }
      if (dto.capacityAdults !== undefined) {
        roomTypeUpdateData.capacityAdults = Number(dto.capacityAdults);
      }
      if (dto.capacityChildren !== undefined) {
        roomTypeUpdateData.capacityChildren = Number(dto.capacityChildren);
      }

      if (Object.keys(roomTypeUpdateData).length > 0) {
        await this.prisma.roomType.update({
          where: { id: effectiveRoomTypeId },
          data: roomTypeUpdateData,
        });
      }
    }

    // 4. Chu?n hóa d? li?u c?p nh?t riêng cho b?ng Room (tránh l?i unknown argument c?a Prisma)
    const roomUpdateData: Prisma.RoomUpdateInput = {};
    if (dto.roomNumber !== undefined) {
      roomUpdateData.roomNumber = dto.roomNumber;
    }
    if (dto.floor !== undefined) {
      roomUpdateData.floor = Number(dto.floor);
    }
    if (targetRoomTypeId) {
      roomUpdateData.roomType = { connect: { id: targetRoomTypeId } };
    }
    if (dto.status !== undefined) {
      roomUpdateData.status = dto.status;
    }
    if (dto.notes !== undefined) {
      roomUpdateData.notes = dto.notes;
    }

    const updated = await this.prisma.room.update({
      where: { id },
      data: roomUpdateData,
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
      images: updated.roomType?.images ?? [],
      imageUrl: updated.roomType?.images?.[0] ?? '',
      amenities: updated.roomType?.amenities ?? [],
      description: updated.roomType?.description ?? null,
      capacityAdults: updated.roomType?.capacityAdults ?? 2,
      capacityChildren: updated.roomType?.capacityChildren ?? 1,
      sizeSqM: updated.roomType?.sizeSqM ? Number(updated.roomType.sizeSqM) : undefined,
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
   * Rà soát và d?ng b? l?i tr?ng thái c?a toàn b? phòng theo l?ch d?t phòng th?c t?.
   * Dùng d? ch?a d? li?u dã l?ch (phòng OCCUPIED nhung không có don CHECKED_IN nào)
   * khi?n ma tr?n phòng c?a l? tân hi?n "Có khách" mà không có khách.
   * Phòng dang MAINTENANCE / PENDING_APPROVAL / REJECTED du?c gi? nguyên.
   */
  async syncAllStatuses() {
    const rooms = await this.prisma.room.findMany({
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED] } },
          // checkInDate là b?t bu?c: thi?u nó, don CONFIRMED c?a k? ngh? sau
          // cung b? coi là dang gi? phòng hôm nay và phòng b? ghi nh?m thành RESERVED.
          select: { status: true, checkInDate: true, checkOutDate: true },
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
          ? `Ðã d?ng b? l?i tr?ng thái cho ${changes.length}/${rooms.length} phòng`
          : `Toàn b? ${rooms.length} phòng dã kh?p v?i l?ch d?t phòng, không c?n thay d?i`,
      totalRooms: rooms.length,
      updatedCount: changes.length,
      changes,
    };
  }

  async updateStatus(id: string, status: RoomStatus) {
    const existing = await this.findOne(id, true);

    // Không cho phép chuy?n th? công sang AVAILABLE / CLEANING / RESERVED n?u phòng dang có khách luu trú
    if (status !== RoomStatus.OCCUPIED) {
      const activeStay = await this.prisma.booking.findFirst({
        where: { roomId: id, status: BookingStatus.CHECKED_IN },
      });
      if (activeStay) {
        throw new BadRequestException(
          `Phòng ${existing.roomNumber} dang có khách luu trú (don ${activeStay.bookingCode}). Vui lòng ki?m tra thanh toán và th?c hi?n th? t?c Tr? phòng & Xu?t hóa don tru?c khi d?i tr?ng thái phòng.`,
        );
      }
    }
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
      images: updated.roomType?.images ?? [],
      imageUrl: updated.roomType?.images?.[0] ?? '',
      amenities: updated.roomType?.amenities ?? [],
      description: updated.roomType?.description ?? null,
      capacityAdults: updated.roomType?.capacityAdults ?? 2,
      capacityChildren: updated.roomType?.capacityChildren ?? 1,
      sizeSqM: updated.roomType?.sizeSqM ? Number(updated.roomType.sizeSqM) : undefined,
      notes: updated.notes,
      updatedAt: updated.updatedAt,
    });

    return toRoomResponse(updated, true);
  }

  async remove(id: string) {
    const existing = await this.findOne(id, true);

    // 1. Ki?m tra don d?t phòng dang ho?t d?ng (Ðang ?, Ðã xác nh?n, Ch? duy?t)
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        roomId: id,
        status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
    });
    if (activeBooking) {
      throw new BadRequestException(
        `Không th? xóa phòng ${existing.roomNumber} vì dang có don d?t phòng chua hoàn t?t (mã don: ${activeBooking.bookingCode}). Vui lòng x? lý don d?t phòng tru?c khi xóa.`,
      );
    }

    // 2. Ki?m tra l?ch s? don d?t phòng (dã hoàn thành ho?c h?y)
    const totalBookings = await this.prisma.booking.count({
      where: { roomId: id },
    });
    if (totalBookings > 0) {
      throw new BadRequestException(
        `Không th? xóa hoàn toàn phòng ${existing.roomNumber} do phòng dã có ${totalBookings} don d?t phòng trong l?ch s?. Ð? ng?ng kinh doanh phòng này, vui lòng chuy?n tr?ng thái phòng sang B?O TRÌ (MAINTENANCE) ho?c T? CH?I (REJECTED).`,
      );
    }

    const deleted = await this.prisma.room.delete({
      where: { id },
    });

    await this.redis.delByPattern('cache:rooms:*');
    await this.esService.removeRoom(id);

    this.roomEvents.emitDeleted(existing.id, existing.roomNumber);

    return deleted;
  }
}
