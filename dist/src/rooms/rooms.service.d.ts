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
    create(dto: CreateRoomDto): Promise<{
        roomType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            basePrice: number;
            capacityAdults: number;
            capacityChildren: number;
            sizeSqM: number | null;
            amenities: string[];
            images: string[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roomNumber: string;
        floor: number;
        status: import(".prisma/client").$Enums.RoomStatus;
        notes: string | null;
        roomTypeId: string;
    }>;
    findAll(status?: RoomStatus, floor?: number, roomTypeId?: string): Promise<({
        roomType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            basePrice: number;
            capacityAdults: number;
            capacityChildren: number;
            sizeSqM: number | null;
            amenities: string[];
            images: string[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roomNumber: string;
        floor: number;
        status: import(".prisma/client").$Enums.RoomStatus;
        notes: string | null;
        roomTypeId: string;
    })[]>;
    findOne(id: string): Promise<{
        bookings: ({
            customer: {
                fullName: string;
                phone: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.BookingStatus;
            bookingCode: string;
            checkInDate: Date;
            checkOutDate: Date;
            actualCheckIn: Date | null;
            actualCheckOut: Date | null;
            guestCount: number;
            totalAmount: number;
            depositAmount: number;
            specialRequests: string | null;
            customerId: string;
            roomId: string;
        })[];
        roomType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            basePrice: number;
            capacityAdults: number;
            capacityChildren: number;
            sizeSqM: number | null;
            amenities: string[];
            images: string[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roomNumber: string;
        floor: number;
        status: import(".prisma/client").$Enums.RoomStatus;
        notes: string | null;
        roomTypeId: string;
    }>;
    findAvailable(query: QueryAvailableRoomsDto): Promise<any[]>;
    search(dto: SearchRoomDto): Promise<import("../elasticsearch/elasticsearch.service").RoomSearchDocument[] | ({
        roomType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            basePrice: number;
            capacityAdults: number;
            capacityChildren: number;
            sizeSqM: number | null;
            amenities: string[];
            images: string[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roomNumber: string;
        floor: number;
        status: import(".prisma/client").$Enums.RoomStatus;
        notes: string | null;
        roomTypeId: string;
    })[]>;
    update(id: string, dto: UpdateRoomDto): Promise<{
        roomType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            basePrice: number;
            capacityAdults: number;
            capacityChildren: number;
            sizeSqM: number | null;
            amenities: string[];
            images: string[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roomNumber: string;
        floor: number;
        status: import(".prisma/client").$Enums.RoomStatus;
        notes: string | null;
        roomTypeId: string;
    }>;
    updateStatus(id: string, status: RoomStatus): Promise<{
        roomType: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            basePrice: number;
            capacityAdults: number;
            capacityChildren: number;
            sizeSqM: number | null;
            amenities: string[];
            images: string[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roomNumber: string;
        floor: number;
        status: import(".prisma/client").$Enums.RoomStatus;
        notes: string | null;
        roomTypeId: string;
    }>;
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
