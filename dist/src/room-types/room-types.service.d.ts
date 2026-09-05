import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
export declare class RoomTypesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateRoomTypeDto): Promise<{
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
    }>;
    findAll(): Promise<({
        _count: {
            rooms: number;
        };
    } & {
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
    })[]>;
    findOne(id: string): Promise<{
        rooms: {
            id: string;
            roomNumber: string;
            floor: number;
            roomTypeId: string;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
    } & {
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
    }>;
    update(id: string, dto: UpdateRoomTypeDto): Promise<{
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
    }>;
    remove(id: string): Promise<{
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
    }>;
}
