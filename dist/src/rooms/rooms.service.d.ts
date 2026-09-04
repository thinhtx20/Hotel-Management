import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { QueryAvailableRoomsDto } from './dto/query-available-rooms.dto';
import { SearchRoomDto } from './dto/search-room.dto';
import { RoomStatus } from '@prisma/client';
export declare class RoomsService {
    private prisma;
    private redis;
    private esService;
    constructor(prisma: PrismaService, redis: RedisService, esService: ElasticsearchService);
    create(dto: CreateRoomDto): Promise<import("./dto/room-response.dto").RoomResponse>;
    findAll(status?: RoomStatus, floor?: number, roomTypeId?: string, isStaff?: boolean): Promise<import("./dto/room-response.dto").RoomResponse[]>;
    findOne(id: string, includeNotes?: boolean): Promise<import("./dto/room-response.dto").RoomResponse>;
    findAvailable(query: QueryAvailableRoomsDto, includeNotes?: boolean): Promise<any[]>;
    search(dto: SearchRoomDto, includeNotes?: boolean): Promise<import("./dto/room-response.dto").RoomResponse[]>;
    update(id: string, dto: UpdateRoomDto): Promise<import("./dto/room-response.dto").RoomResponse>;
    syncAllStatuses(): Promise<{
        message: string;
        totalRooms: number;
        updatedCount: number;
        changes: {
            roomNumber: string;
            from: RoomStatus;
            to: RoomStatus;
        }[];
    }>;
    updateStatus(id: string, status: RoomStatus): Promise<import("./dto/room-response.dto").RoomResponse>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roomNumber: string;
        floor: number;
        status: import(".prisma/client").$Enums.RoomStatus;
        notes: string | null;
        roomTypeId: string;
    }>;
}
