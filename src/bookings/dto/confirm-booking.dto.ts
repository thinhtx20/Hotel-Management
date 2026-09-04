import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Body cho PATCH|POST /bookings/{id}/confirm
 * Lễ tân/Admin xác nhận đơn khách tự đặt: PENDING -> CONFIRMED.
 * Tất cả các trường đều không bắt buộc, gọi với body rỗng vẫn xác nhận được đơn.
 */
export class ConfirmBookingDto {
  @ApiPropertyOptional({
    example: '3f6c8d20-41ab-4f27-96a8-208935cba48b',
    description:
      'ID phòng được xếp cho khách. Bỏ trống sẽ giữ nguyên phòng khách đã chọn khi đặt. ' +
      'Nếu truyền phòng khác, hệ thống kiểm tra trùng lịch rồi mới chuyển đơn sang phòng mới.',
  })
  @IsOptional()
  @IsString()
  assignedRoomId?: string;

  @ApiPropertyOptional({
    example: 'Khách đã chuyển khoản cọc, xếp phòng tầng cao theo yêu cầu',
    description: 'Ghi chú của lễ tân khi xác nhận đơn',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Số tiền cọc đã thu (VND). Bỏ trống sẽ giữ nguyên tiền cọc hiện có của đơn.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.BANK_TRANSFER,
    description: 'Phương thức thu tiền cọc (chỉ dùng khi depositAmount > 0)',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
