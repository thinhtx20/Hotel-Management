import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body cho POST|PATCH /bookings/{id}/cancel
 * Dùng chung cho khách tự hủy đơn và lễ tân/admin hủy hộ.
 * `reason` được giữ lại làm alias để client cũ không bị vỡ.
 */
export class CancelBookingDto {
  @ApiPropertyOptional({
    example: 'Khách báo bận công tác đột xuất, xin hủy phòng',
    description: 'Lý do hủy đơn. Được lưu lại và trả về trong mọi response của đơn đặt phòng.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Lý do hủy tối đa 1000 ký tự' })
  cancellationReason?: string;

  @ApiPropertyOptional({
    example: 'Khách báo bận công tác đột xuất, xin hủy phòng',
    description: 'Alias của cancellationReason (tương thích ngược với client cũ)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Lý do hủy tối đa 1000 ký tự' })
  reason?: string;
}
