import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RoomStatus } from '@prisma/client';

export enum RoomSortOption {
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  FLOOR_DESC = 'FLOOR_DESC',
}

export class SearchRoomDto {
  @ApiPropertyOptional({ example: 'view biển ban công', description: 'Từ khóa tìm kiếm (Tên phòng, mô tả, tiện nghi)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 500000, description: 'Giá thấp nhất (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 2000000, description: 'Giá cao nhất (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: ['Wifi', 'Bồn tắm'],
    type: [String],
    description: 'Lọc danh sách tiện ích yêu cầu (mảng hoặc chuỗi phân tách bởi dấu phẩy)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
    return value;
  })
  @IsArray()
  amenities?: string[];

  @ApiPropertyOptional({
    enum: RoomSortOption,
    example: RoomSortOption.PRICE_ASC,
    description: 'Sắp xếp kết quả tìm kiếm (PRICE_ASC: Giá tăng dần, PRICE_DESC: Giá giảm dần, FLOOR_DESC: Tầng cao xuống)',
  })
  @IsOptional()
  @IsEnum(RoomSortOption)
  sort?: RoomSortOption;

  @ApiPropertyOptional({ example: 2, description: 'Lọc theo số tầng' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  floor?: number;

  @ApiPropertyOptional({
    enum: RoomStatus,
    example: RoomStatus.AVAILABLE,
    description: 'Lọc theo trạng thái phòng (mặc định không ép cứng AVAILABLE nếu không truyền)',
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
