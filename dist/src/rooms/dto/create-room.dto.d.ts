import { RoomStatus } from '@prisma/client';
export declare class CreateRoomDto {
    roomNumber: string;
    floor: number;
    roomTypeId?: string;
    roomTypeName?: string;
    roomTypeCode?: string;
    status?: RoomStatus;
    notes?: string;
    pricePerNight?: number;
    price?: number;
    basePrice?: number;
    image?: string;
    imageUrl?: string;
    images?: string[];
    amenities?: string[];
    description?: string;
    sizeSqM?: number;
    capacityAdults?: number;
    capacityChildren?: number;
}
