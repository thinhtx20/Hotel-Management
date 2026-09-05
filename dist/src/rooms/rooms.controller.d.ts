import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RoomsService } from './rooms.service';
import { RoomEventsService } from './room-events.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto, UpdateRoomStatusDto } from './dto/update-room.dto';
import { QueryAvailableRoomsDto } from './dto/query-available-rooms.dto';
import { SearchRoomDto } from './dto/search-room.dto';
import { RoomStatus } from '@prisma/client';
export declare class RoomsController {
    private readonly roomsService;
    private readonly roomEvents;
    constructor(roomsService: RoomsService, roomEvents: RoomEventsService);
    create(createRoomDto: CreateRoomDto, user?: any): Promise<import("./dto/room-response.dto").RoomResponse>;
    stream(user?: any): Observable<MessageEvent>;
    search(searchDto: SearchRoomDto, user?: any): Promise<import("./dto/room-response.dto").RoomResponse[]>;
    findAvailable(query: QueryAvailableRoomsDto, user?: any): Promise<any[]>;
    findAll(status?: RoomStatus, floor?: number, roomTypeId?: string, user?: any): Promise<import("./dto/room-response.dto").RoomResponse[]>;
    findOne(id: string, user?: any): Promise<import("./dto/room-response.dto").RoomResponse>;
    approve(id: string): Promise<import("./dto/room-response.dto").RoomResponse>;
    reject(id: string): Promise<import("./dto/room-response.dto").RoomResponse>;
    syncStatus(): Promise<{
        message: string;
        totalRooms: number;
        updatedCount: number;
        changes: {
            roomNumber: string;
            from: RoomStatus;
            to: RoomStatus;
        }[];
    }>;
    updateStatus(id: string, dto: UpdateRoomStatusDto): Promise<import("./dto/room-response.dto").RoomResponse>;
    update(id: string, updateRoomDto: UpdateRoomDto): Promise<import("./dto/room-response.dto").RoomResponse>;
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
