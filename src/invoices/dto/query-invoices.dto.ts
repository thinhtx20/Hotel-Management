import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum InvoiceTimeFilterType {
  WEEK = 'week',
  MONTH_RANGE = 'month_range',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class QueryInvoicesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Lọc theo trạng thái thanh toán (UNPAID, PARTIAL, PAID, REFUNDED)',
  })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'status phải là một trong: UNPAID, PARTIAL, PAID, REFUNDED' })
  status?: PaymentStatus;

  @ApiPropertyOptional({
    enum: InvoiceTimeFilterType,
    example: InvoiceTimeFilterType.WEEK,
    description:
      'Chế độ lọc thời gian: week (theo tuần - mặc định), month_range (từ tháng đến tháng), year (theo cả năm), custom (theo ngày bắt đầu/kết thúc)',
  })
  @IsOptional()
  @IsEnum(InvoiceTimeFilterType, {
    message: 'filterType phải là một trong: week, month_range, year, custom',
  })
  filterType?: InvoiceTimeFilterType;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Năm cần tra cứu (dành cho Admin khi lọc theo năm hoặc khoảng tháng)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'year phải là số nguyên' })
  @Min(2000, { message: 'year tối thiểu là 2000' })
  @Max(2100, { message: 'year tối đa là 2100' })
  year?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Tháng bắt đầu (1-12) khi Admin chọn lọc từ tháng này đến tháng khác',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'fromMonth phải là số nguyên (1 - 12)' })
  @Min(1, { message: 'fromMonth tối thiểu là 1' })
  @Max(12, { message: 'fromMonth tối đa là 12' })
  fromMonth?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Tháng kết thúc (1-12) khi Admin chọn lọc từ tháng này đến tháng khác',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'toMonth phải là số nguyên (1 - 12)' })
  @Min(1, { message: 'toMonth tối thiểu là 1' })
  @Max(12, { message: 'toMonth tối đa là 12' })
  toMonth?: number;

  @ApiPropertyOptional({
    example: 9,
    description: 'Tháng cụ thể (1-12) khi muốn xem hóa đơn trong 1 tháng duy nhất',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'month phải là số nguyên (1 - 12)' })
  @Min(1, { message: 'month tối thiểu là 1' })
  @Max(12, { message: 'month tối đa là 12' })
  month?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Độ lệch tuần: 0 là tuần này, -1 là tuần trước, 1 là tuần sau',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'weekOffset phải là số nguyên' })
  weekOffset?: number;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Ngày bắt đầu định dạng YYYY-MM-DD (dùng cho custom range)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Ngày kết thúc định dạng YYYY-MM-DD (dùng cho custom range)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

