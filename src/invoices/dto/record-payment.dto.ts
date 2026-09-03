import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ example: 1500000, description: 'Số tiền thanh toán (VND)' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH, description: 'Phương thức thanh toán' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.PAID, description: 'Trạng thái thanh toán' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ example: 'Khách thanh toán quẹt thẻ POS Vietcombank', description: 'Ghi chú thu ngân' })
  @IsOptional()
  @IsString()
  notes?: string;
}
