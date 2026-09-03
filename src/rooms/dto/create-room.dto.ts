import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: '101', description: 'Số phòng (duy nhất)' })
  @IsString()
  @IsNotEmpty({ message: 'Số phòng không được để trống' })
  roomNumber: string;

  @ApiProperty({ example: 1, description: 'Tầng' })
  @IsInt()
  @Min(1)
  floor: number;

  @ApiProperty({ example: 'uuid-room-type', description: 'ID của loại phòng' })
  @IsString()
  @IsNotEmpty({ message: 'Loại phòng là bắt buộc' })
  roomTypeId: string;

  @ApiPropertyOptional({ enum: RoomStatus, default: RoomStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ example: 'Cạnh thang máy, view nhìn ra sân vườn' })
  @IsOptional()
  @IsString()
  notes?: string;
}
