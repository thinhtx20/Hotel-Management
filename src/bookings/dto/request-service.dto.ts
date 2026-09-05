import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RequestServiceDto {
  @ApiProperty({ example: 'Giặt là cao cấp', description: 'Tên dịch vụ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên dịch vụ không được để trống' })
  serviceName: string;

  @ApiProperty({ example: 50000, description: 'Đơn giá dịch vụ' })
  @IsNumber({}, { message: 'Đơn giá phải là số' })
  @IsPositive({ message: 'Đơn giá phải lớn hơn 0' })
  unitPrice: number;

  @ApiPropertyOptional({ example: 2, default: 1, description: 'Số lượng' })
  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @IsPositive({ message: 'Số lượng phải lớn hơn 0' })
  quantity?: number;

  @ApiPropertyOptional({ example: 'Lấy quần áo trước 10h sáng', description: 'Ghi chú thêm của khách' })
  @IsOptional()
  @IsString()
  note?: string;
}
