import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class QueryAvailableRoomsDto {
  @ApiProperty({ example: '2026-09-05T14:00:00.000Z', description: 'Ngày dự kiến nhận phòng' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  checkInDate: Date;

  @ApiProperty({ example: '2026-09-08T12:00:00.000Z', description: 'Ngày dự kiến trả phòng' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  checkOutDate: Date;

  @ApiPropertyOptional({ example: 2, description: 'Số lượng khách' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ example: 'uuid-room-type', description: 'Lọc theo loại phòng cụ thể' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;
}
