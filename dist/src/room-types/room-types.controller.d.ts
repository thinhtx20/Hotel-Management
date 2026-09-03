import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
export declare class RoomTypesController {
    private readonly roomTypesService;
    constructor(roomTypesService: RoomTypesService);
    create(createRoomTypeDto: CreateRoomTypeDto): Promise<{
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
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
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
    update(id: string, updateRoomTypeDto: UpdateRoomTypeDto): Promise<{
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
