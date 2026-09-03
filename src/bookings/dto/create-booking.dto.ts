import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookingDto {
  @ApiPropertyOptional({ example: 'uuid-user-id', description: 'ID khách hàng (nếu Lễ tân đặt hộ, để trống sẽ lấy user đang login)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ example: 'uuid-room-id', description: 'ID phòng cần đặt' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn phòng' })
  roomId: string;

  @ApiProperty({ example: '2026-09-10T14:00:00.000Z', description: 'Ngày dự kiến nhận phòng' })
  @IsNotEmpty({ message: 'Ngày nhận phòng là bắt buộc' })
  @Type(() => Date)
  @IsDate()
  checkInDate: Date;

  @ApiProperty({ example: '2026-09-12T12:00:00.000Z', description: 'Ngày dự kiến trả phòng' })
  @IsNotEmpty({ message: 'Ngày trả phòng là bắt buộc' })
  @Type(() => Date)
  @IsDate()
  checkOutDate: Date;

  @ApiPropertyOptional({ example: 2, default: 1, description: 'Số lượng khách' })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ example: 500000, default: 0, description: 'Số tiền đặt cọc trước (VND)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ example: 'Yêu cầu phòng không hút thuốc, check-in sớm 1 tiếng', description: 'Ghi chú đặc biệt của khách' })
  @IsOptional()
  @IsString()
  specialRequests?: string;
}
