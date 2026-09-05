import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryInvoicesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Lọc theo trạng thái thanh toán (UNPAID, PARTIAL, PAID, REFUNDED)',
  })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'status phải là một trong: UNPAID, PARTIAL, PAID, REFUNDED' })
  status?: PaymentStatus;
}
