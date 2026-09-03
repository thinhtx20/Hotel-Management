import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'ID đơn đặt phòng tương ứng', example: 'uuid-booking-123' })
  @IsNotEmpty({ message: 'bookingId không được để trống' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Tiền phòng', example: 1200000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  roomAmount?: number;

  @ApiProperty({ description: 'Tiền dịch vụ phụ trợ', example: 150000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  servicesAmount?: number;

  @ApiProperty({ description: 'Số tiền chiết khấu', example: 50000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ description: 'Thuế suất (mặc định 0.1 = 10%)', example: 0.1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiProperty({ description: 'Phương thức thanh toán', enum: PaymentMethod, default: PaymentMethod.CASH, required: false })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty({ description: 'Ghi chú thêm', example: 'Hóa đơn phát sinh lẻ', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
