import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus, ShiftType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryShiftsDto {
  @ApiPropertyOptional({
    description: 'Lọc theo ID nhân viên trực ca',
  })
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional({
    enum: ShiftStatus,
    description: 'Lọc theo trạng thái ca trực (OPEN: Đang trực, CLOSED: Đã chốt ca)',
  })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @ApiPropertyOptional({
    enum: ShiftType,
    description: 'Lọc theo loại ca: MORNING, AFTERNOON, NIGHT, CUSTOM',
  })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;

  @ApiPropertyOptional({
    description: 'Lọc từ ngày (định dạng YYYY-MM-DD hoặc ISO string)',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Lọc đến ngày (định dạng YYYY-MM-DD hoặc ISO string)',
    example: '2026-09-07',
  })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Số trang (mặc định 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Số bản ghi mỗi trang (mặc định 10)',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}
