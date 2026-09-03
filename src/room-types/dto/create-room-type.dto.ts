import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'Phòng Deluxe Hướng Biển', description: 'Tên loại phòng' })
  @IsString()
  @IsNotEmpty({ message: 'Tên loại phòng không được để trống' })
  name: string;

  @ApiProperty({ example: 'DLX-OCEAN', description: 'Mã loại phòng độc nhất' })
  @IsString()
  @IsNotEmpty({ message: 'Mã loại phòng không được để trống' })
  code: string;

  @ApiPropertyOptional({ example: 'Phòng cao cấp ban công view biển, bồn tắm nằm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1500000, description: 'Giá cơ bản một đêm (VND)' })
  @IsNumber()
  @Min(0, { message: 'Giá phòng không được âm' })
  basePrice: number;

  @ApiPropertyOptional({ example: 2, default: 2, description: 'Số người lớn tối đa' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacityAdults?: number;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Số trẻ em tối đa' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityChildren?: number;

  @ApiPropertyOptional({ example: 42.5, description: 'Diện tích (m2)' })
  @IsOptional()
  @IsNumber()
  sizeSqM?: number;

  @ApiPropertyOptional({
    example: ['Wifi', 'Smart TV 55 inch', 'Bồn tắm', 'Minibar', 'Ban công'],
    type: [String],
    description: 'Danh sách tiện ích',
  })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiPropertyOptional({
    example: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b'],
    type: [String],
    description: 'Danh sách link ảnh phòng',
  })
  @IsOptional()
  @IsArray()
  images?: string[];
}
