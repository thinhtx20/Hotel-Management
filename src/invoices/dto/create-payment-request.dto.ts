import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Khách hàng bấm "Thanh toán" trên app.
 *
 * Tiền CHƯA được cộng vào hóa đơn ở bước này — hệ thống chỉ ghi nhận một yêu cầu
 * ở trạng thái PENDING để thu ngân đối chiếu (sao kê ngân hàng / tiền mặt tại quầy)
 * rồi mới xác nhận. Bỏ trống `amount` nghĩa là khách trả TOÀN BỘ số còn lại.
 */
export class CreatePaymentRequestDto {
  @ApiPropertyOptional({
    example: 2564000,
    description:
      'Số tiền khách muốn trả (VND). Bỏ trống để thanh toán toàn bộ số còn lại của hóa đơn.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.BANK_TRANSFER,
    description: 'Hình thức khách sẽ trả tiền',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.BANK_TRANSFER;

  @ApiPropertyOptional({
    example: 'FT25090512345678',
    description: 'Mã giao dịch chuyển khoản để thu ngân đối chiếu sao kê',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({
    example: 'Đã chuyển khoản lúc 14:05, nhờ lễ tân kiểm tra giúp',
    description: 'Ghi chú của khách gửi kèm',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
