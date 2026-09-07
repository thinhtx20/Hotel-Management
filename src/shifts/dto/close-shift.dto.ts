import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CloseShiftDto {
  @ApiProperty({
    example: 4500000,
    description: 'Số tiền mặt thực tế kiểm đếm có trong két lúc chốt ca',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'actualCash phải là số tiền hợp lệ' })
  @Min(0, { message: 'actualCash không được âm' })
  actualCash: number;

  @ApiPropertyOptional({
    example: 'Đã hoàn tất bàn giao sổ quỹ và chìa khóa két',
    description: 'Ghi chú tổng kết khi chốt ca',
  })
  @IsOptional()
  @IsString({ message: 'closeNote phải là chuỗi ký tự' })
  closeNote?: string;

  @ApiPropertyOptional({
    example: 'Lệch 50.000đ do khách thối lại tiền tip chưa kịp hạch toán',
    description: 'Giải trình lý do chênh lệch tiền mặt nếu có (thừa hoặc thiếu)',
  })
  @IsOptional()
  @IsString({ message: 'differenceReason phải là chuỗi ký tự' })
  differenceReason?: string;

  @ApiPropertyOptional({
    example: 'c1d2e3f4-5678-90ab-cdef-1234567890ab',
    description: 'ID của nhân viên lễ tân nhận bàn giao ca tiếp theo',
  })
  @IsOptional()
  @IsString({ message: 'handoverStaffId phải là UUID hợp lệ' })
  handoverStaffId?: string;
}
