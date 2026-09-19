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

  /**
   * Tùy chọn tính lại tiền phòng theo số đêm thực tế khi khách trả phòng trước hạn (Early Check-Out).
   * Mặc định là true khi trả phòng trước hạn.
   */
  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Tính lại tiền phòng theo số đêm thực tế (true) hay giữ nguyên tiền phòng theo đơn đặt ban đầu (false)',
  })
  @IsOptional()
  recalculateRoomAmount?: boolean;

  /**
   * Số tiền phòng tùy chỉnh nếu thu ngân muốn nhập tay.
   */
  @ApiPropertyOptional({
    example: 1200000,
    description: 'Số tiền phòng tùy chỉnh (VND)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customRoomAmount?: number;

  /**
   * Số tiền hoàn trả cho khách tại quầy khi khách đã thanh toán/đặt cọc thừa lúc trả phòng sớm.
   */
  @ApiPropertyOptional({
    example: 500000,
    description: 'Số tiền hoàn trả cho khách tại quầy (VND)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  /**
   * Phương thức hoàn tiền cho khách.
   */
  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
    description: 'Phương thức hoàn tiền (CASH, BANK_TRANSFER, CREDIT_CARD)',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  refundMethod?: PaymentMethod;

  /**
   * Lý do hoàn tiền trả phòng trước hạn.
   */
  @ApiPropertyOptional({
    example: 'Khách trả phòng trước hạn 2 đêm',
    description: 'Lý do hoàn tiền',
  })
  @IsOptional()
  @IsString()
  refundReason?: string;
}
