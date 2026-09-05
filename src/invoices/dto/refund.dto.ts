import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RefundDto {
  @ApiProperty({ example: 500000, description: 'Số tiền hoàn lại cho khách (<= số tiền đã thanh toán)' })
  @IsNumber({}, { message: 'Số tiền hoàn phải là số' })
  @IsPositive({ message: 'Số tiền hoàn phải lớn hơn 0' })
  amount: number;

  @ApiProperty({ example: 'Khách trả phòng sớm 1 đêm', description: 'Lý do hoàn tiền' })
  @IsString()
  @IsNotEmpty({ message: 'Lý do hoàn tiền là bắt buộc' })
  reason: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
    description: 'Hình thức trả tiền lại cho khách, để đối chiếu sổ quỹ cuối ca',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
