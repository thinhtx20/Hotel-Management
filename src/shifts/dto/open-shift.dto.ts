import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenShiftDto {
  @ApiProperty({
    enum: ShiftType,
    example: ShiftType.MORNING,
    description: 'Loại ca trực: MORNING (Sáng), AFTERNOON (Chiều), NIGHT (Đêm), CUSTOM (Linh hoạt)',
  })
  @IsEnum(ShiftType, { message: 'shiftType phải là một trong: MORNING, AFTERNOON, NIGHT, CUSTOM' })
  shiftType: ShiftType;

  @ApiProperty({
    example: 2000000,
    description: 'Số tiền mặt nhận bàn giao đầu ca trong két (tiền thối sẵn)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'initialCash phải là số tiền hợp lệ' })
  @Min(0, { message: 'initialCash không được âm' })
  initialCash: number;

  @ApiPropertyOptional({
    example: 'Quầy 1 - Sảnh chính',
    description: 'Tên quầy hoặc máy POS trực',
  })
  @IsOptional()
  @IsString({ message: 'deskName phải là chuỗi ký tự' })
  deskName?: string;

  @ApiPropertyOptional({
    example: 'Nhận bàn giao từ ca đêm, két tiền đầy đủ mệnh giá nhỏ',
    description: 'Ghi chú khi nhận ca',
  })
  @IsOptional()
  @IsString({ message: 'note phải là chuỗi ký tự' })
  note?: string;
}
