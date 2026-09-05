import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaymentEntryStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryPaymentRequestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PaymentEntryStatus,
    description: 'Lọc theo trạng thái yêu cầu thanh toán (PENDING, CONFIRMED, REJECTED)',
  })
  @IsOptional()
  @IsEnum(PaymentEntryStatus, {
    message: 'status phải là một trong: PENDING, CONFIRMED, REJECTED',
  })
  status?: PaymentEntryStatus;
}
