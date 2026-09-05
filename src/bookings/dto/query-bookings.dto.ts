import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Chuẩn hóa `status` về mảng: chấp nhận cả
 *  ?status=PENDING
 *  ?status=PENDING,CONFIRMED
 *  ?status=PENDING&status=CONFIRMED
 */
const toStatusArray = ({ value }: { value: unknown }): BookingStatus[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const flat = raw
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim().toUpperCase())
    .filter((v) => v.length > 0);
  return flat.length > 0 ? (flat as BookingStatus[]) : undefined;
};

export class QueryBookingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: BookingStatus,
    isArray: true,
    description:
      'Lọc theo một hoặc nhiều trạng thái. Hỗ trợ ?status=PENDING,CONFIRMED hoặc lặp ?status=PENDING&status=CONFIRMED',
    example: ['PENDING', 'CONFIRMED'],
  })
  @IsOptional()
  @Transform(toStatusArray)
  @IsArray()
  @IsEnum(BookingStatus, { each: true, message: 'Trạng thái đơn đặt phòng không hợp lệ' })
  status?: BookingStatus[];

  @ApiPropertyOptional({ description: 'Lọc theo ID khách hàng' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID phòng' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({
    example: '2026-09-04',
    description: 'Ngày nhận phòng từ (bao gồm cả ngày này, tính theo 00:00 giờ máy chủ)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'checkInFrom phải là ngày hợp lệ (YYYY-MM-DD hoặc ISO 8601)' })
  checkInFrom?: Date;

  @ApiPropertyOptional({
    example: '2026-09-04',
    description: 'Ngày nhận phòng đến (bao gồm trọn ngày này, tính đến 23:59:59)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'checkInTo phải là ngày hợp lệ (YYYY-MM-DD hoặc ISO 8601)' })
  checkInTo?: Date;

  @ApiPropertyOptional({ example: '2026-09-04', description: 'Ngày trả phòng từ' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'checkOutFrom phải là ngày hợp lệ (YYYY-MM-DD hoặc ISO 8601)' })
  checkOutFrom?: Date;

  @ApiPropertyOptional({ example: '2026-09-04', description: 'Ngày trả phòng đến' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'checkOutTo phải là ngày hợp lệ (YYYY-MM-DD hoặc ISO 8601)' })
  checkOutTo?: Date;

  @ApiPropertyOptional({
    example: '0912345678',
    description:
      'Tìm kiếm không phân biệt hoa thường theo: tên khách, số điện thoại, email, mã đơn (bookingCode) hoặc số phòng',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Trang hiện tại (bắt đầu từ 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Số bản ghi mỗi trang (tối đa 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
