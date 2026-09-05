import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateHotelServiceDto {
  @ApiProperty({ example: 'LAUNDRY', description: 'Mã định danh dịch vụ (duy nhất)' })
  @IsString()
  @IsNotEmpty({ message: 'Mã dịch vụ không được để trống' })
  code: string;

  @ApiProperty({ example: 'Giặt là cao cấp', description: 'Tên dịch vụ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên dịch vụ không được để trống' })
  name: string;

  @ApiProperty({
    example: 'CONVENIENCE',
    description: 'Danh mục: FOOD_BEVERAGE | WELLNESS | TRANSPORT | CONVENIENCE | ROOM_SERVICE',
  })
  @IsString()
  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  category: string;

  @ApiPropertyOptional({ example: 'Giặt ủi quần áo lấy trong ngày, đóng gói cẩn thận', description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 50000, description: 'Đơn giá dịch vụ' })
  @IsNumber({}, { message: 'Đơn giá phải là số' })
  @IsPositive({ message: 'Đơn giá phải lớn hơn 0' })
  unitPrice: number;

  @ApiPropertyOptional({ example: 'món', default: 'lần', description: 'Đơn vị tính' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 'local_laundry_service', description: 'Tên icon hiển thị' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Trạng thái khả dụng' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
