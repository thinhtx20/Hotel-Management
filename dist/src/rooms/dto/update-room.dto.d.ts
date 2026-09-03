import { CreateRoomDto } from './create-room.dto';
import { RoomStatus } from '@prisma/client';
declare const UpdateRoomDto_base: import("@nestjs/common").Type<Partial<CreateRoomDto>>;
export declare class UpdateRoomDto extends UpdateRoomDto_base {
}
export declare class UpdateRoomStatusDto {
    status: RoomStatus;
}
export {};
