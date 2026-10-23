import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateHotelServiceDto {
  @ApiPropertyOptional({ example: 'LAUNDRY', description: 'Mã định danh dịch vụ (duy nhất - tự sinh nếu để trống)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Giặt là cao cấp', description: 'Tên dịch vụ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên dịch vụ không được để trống' })
  name: string;

  @ApiPropertyOptional({
    example: 'CONVENIENCE',
    description: 'Danh mục: FOOD_BEVERAGE | WELLNESS | TRANSPORT | CONVENIENCE | ROOM_SERVICE',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Giặt ủi quần áo lấy trong ngày, đóng gói cẩn thận', description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Đơn giá dịch vụ' })
  @IsOptional()
  @IsNumber({}, { message: 'Đơn giá phải là số' })
  @IsPositive({ message: 'Đơn giá phải lớn hơn 0' })
  unitPrice?: number;

  @ApiPropertyOptional({ example: 50000, description: 'Bí danh đơn giá cho client gửi price' })
  @IsOptional()
  @IsNumber({}, { message: 'Đơn giá phải là số' })
  @IsPositive({ message: 'Đơn giá phải lớn hơn 0' })
  price?: number;

  @ApiPropertyOptional({ example: 'món', default: 'lần', description: 'Đơn vị tính' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 'local_laundry_service', description: 'Tên icon hiển thị' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 'https://...', description: 'Link ảnh đại diện' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Trạng thái khả dụng' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
