import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRoomDto } from './create-room.dto';
import { RoomStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export class UpdateRoomStatusDto {
  @ApiPropertyOptional({ enum: RoomStatus, example: RoomStatus.CLEANING })
  @IsEnum(RoomStatus)
  status: RoomStatus;
}
