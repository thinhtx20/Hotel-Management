import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CHECKED_IN })
  @IsEnum(BookingStatus)
  status: BookingStatus;
}

export class AddServiceOrderDto {
  @ApiProperty({ example: 'Bia Heineken (Minibar)', description: 'Tên dịch vụ / đồ uống' })
  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @ApiProperty({ example: 40000, description: 'Đơn giá (VND)' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 2, default: 1, description: 'Số lượng' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CheckOutDto {
  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH, description: 'Phương thức thanh toán' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Số tiền giảm giá (VND)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 0.1, default: 0.1, description: 'Thuế VAT (0.1 = 10%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}
