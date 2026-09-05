import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Thu ngân xác nhận đã thực sự nhận được tiền của một yêu cầu thanh toán.
 * Chỉ sau bước này khoản tiền mới được cộng vào `paidAmount` của hóa đơn.
 */
export class ConfirmPaymentDto {
  @ApiPropertyOptional({
    example: 2564000,
    description:
      'Số tiền thực nhận, dùng khi khách chuyển thiếu/thừa so với yêu cầu. Bỏ trống thì lấy đúng số khách đã yêu cầu.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Hình thức thực nhận, nếu khác với hình thức khách chọn ban đầu',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'Đã đối chiếu sao kê Vietcombank lúc 14:20',
    description: 'Ghi chú của thu ngân',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Thu ngân từ chối yêu cầu thanh toán (không tìm thấy giao dịch, sai số tiền...). */
export class RejectPaymentDto {
  @ApiProperty({
    example: 'Không tìm thấy giao dịch với mã FT25090512345678 trên sao kê',
    description: 'Lý do từ chối, sẽ hiển thị lại cho khách trên app',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
