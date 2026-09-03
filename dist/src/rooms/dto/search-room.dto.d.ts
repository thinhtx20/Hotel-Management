import { RoomStatus } from '@prisma/client';
export declare enum RoomSortOption {
    PRICE_ASC = "PRICE_ASC",
    PRICE_DESC = "PRICE_DESC",
    FLOOR_DESC = "FLOOR_DESC"
}
export declare class SearchRoomDto {
    q?: string;
    minPrice?: number;
    maxPrice?: number;
    amenities?: string[];
    sort?: RoomSortOption;
    floor?: number;
    status?: RoomStatus;
}
