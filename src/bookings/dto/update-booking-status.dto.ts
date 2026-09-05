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

  /**
   * Tiền thu ngân thực nhận tại quầy lúc trả phòng.
   *
   * Bỏ trống = không thu thêm đồng nào: hóa đơn giữ nguyên số đã thu trước đó
   * (tiền cọc, các lần khách trả qua app) và phần còn thiếu sẽ hiện trong
   * "Hóa đơn của tôi" để khách thanh toán nốt.
   */
  @ApiPropertyOptional({
    example: 2564000,
    description:
      'Số tiền thu ngân thực nhận tại quầy khi trả phòng (VND). ' +
      'Bỏ trống nếu khách không trả thêm — phần còn thiếu sẽ được đẩy về app cho khách tự thanh toán. ' +
      'Gọi GET /bookings/:id/checkout-preview trước để biết chính xác số phải thu.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountCollected?: number;

  @ApiPropertyOptional({
    example: 'Khách trả nốt bằng tiền mặt tại quầy',
    description: 'Ghi chú của thu ngân cho khoản thu lúc trả phòng',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
