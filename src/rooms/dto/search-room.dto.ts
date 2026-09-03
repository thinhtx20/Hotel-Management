import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
    description: 'Lọc danh sách tiện ích yêu cầu',
  })
  @IsOptional()
  @IsArray()
  amenities?: string[];
}
