import { OnModuleInit } from '@nestjs/common';
import { Room, RoomType } from '@prisma/client';
export interface RoomSearchDocument {
    id: string;
    roomNumber: string;
    floor: number;
    status: string;
    roomTypeId: string;
    roomTypeName: string;
    code: string;
    description: string;
    basePrice: number;
    capacityAdults: number;
    capacityChildren: number;
    amenities: string[];
}
export declare class ElasticsearchService implements OnModuleInit {
    private readonly logger;
    private client;
    private isConnected;
    private readonly INDEX_NAME;
    onModuleInit(): Promise<void>;
    get isReady(): boolean;
    private initIndex;
    indexRoom(roomDoc: RoomSearchDocument): Promise<void>;
    indexRoomEntity(room: Room & {
        roomType: RoomType;
    }): Promise<void>;
    removeRoom(roomId: string): Promise<void>;
    searchRooms(query?: string, minPrice?: number, maxPrice?: number, amenities?: string[], floor?: number, status?: string, sort?: string): Promise<string[]>;
}
