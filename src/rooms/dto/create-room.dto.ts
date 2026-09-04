import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @ApiProperty({ example: '101', description: 'Số phòng (duy nhất)' })
  @IsString()
  @IsNotEmpty({ message: 'Số phòng không được để trống' })
  roomNumber: string;

  @ApiProperty({ example: 1, description: 'Tầng' })
  @Type(() => Number)
  @IsInt({ message: 'Tầng phải là số nguyên' })
  @Min(1, { message: 'Tầng phải lớn hơn hoặc bằng 1' })
  floor: number;

  @ApiPropertyOptional({ example: 'uuid-room-type', description: 'ID của loại phòng' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional({ example: 'Standard Queen Double', description: 'Tên loại phòng (tự động map nếu không có ID)' })
  @IsOptional()
  @IsString()
  roomTypeName?: string;

  @ApiPropertyOptional({ example: 'STD-D', description: 'Mã loại phòng (tự động map nếu không có ID)' })
  @IsOptional()
  @IsString()
  roomTypeCode?: string;

  @ApiPropertyOptional({ enum: RoomStatus, default: RoomStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ example: 'Cạnh thang máy, view nhìn ra sân vườn' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 1200000, description: 'Giá phòng mỗi đêm' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pricePerNight?: number;

  @ApiPropertyOptional({ example: 1200000, description: 'Alias của giá phòng' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 1200000, description: 'Alias giá cơ bản' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  basePrice?: number;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...', description: 'Ảnh đại diện chính' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...', description: 'Alias ảnh đại diện' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: ['https://images.unsplash.com/...'], description: 'Danh sách ảnh phòng' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ example: ['Wifi tốc độ cao', 'Điều hòa 2 chiều'], description: 'Danh sách tiện ích' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ example: 'Phòng ban công hướng biển thoáng mát', description: 'Mô tả chi tiết phòng' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 35, description: 'Diện tích phòng (m²)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sizeSqM?: number;

  @ApiPropertyOptional({ example: 2, description: 'Sức chứa người lớn' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  capacityAdults?: number;

  @ApiPropertyOptional({ example: 1, description: 'Sức chứa trẻ em' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  capacityChildren?: number;
}

