import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ApproveBookingDto {
  @ApiPropertyOptional({
    example: 500000,
    description: 'Số tiền đặt cọc (VND) khách đã đóng khi được duyệt đơn',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.BANK_TRANSFER,
    description: 'Phương thức thanh toán tiền cọc (CASH, CREDIT_CARD, BANK_TRANSFER)',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'Khách đã chuyển khoản cọc qua VietQR thành công',
    description: 'Ghi chú xác nhận tiền cọc hoặc thông tin duyệt phòng',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectBookingDto {
  @ApiPropertyOptional({
    example: 'Khách không chuyển tiền cọc đúng hạn theo quy định',
    description:
      'Lý do từ chối đơn đặt phòng. Được lưu vào cancellationReason và trả về trong mọi response của đơn.',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: 'Khách không chuyển tiền cọc đúng hạn theo quy định',
    description: 'Alias của reason (dùng chung tên trường với API hủy đơn)',
  })
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
