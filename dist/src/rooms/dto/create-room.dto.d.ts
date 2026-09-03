import { RoomStatus } from '@prisma/client';
export declare class CreateRoomDto {
    roomNumber: string;
    floor: number;
    roomTypeId: string;
    status?: RoomStatus;
    notes?: string;
}
