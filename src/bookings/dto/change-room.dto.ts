import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChangeRoomDto {
  @ApiProperty({ example: 'room-uuid', description: 'ID phòng mới cần chuyển tới' })
  @IsString()
  @IsNotEmpty({ message: 'Phòng mới là bắt buộc' })
  newRoomId: string;

  @ApiProperty({ example: 'Điều hòa phòng 301 hỏng', description: 'Lý do đổi phòng' })
  @IsString()
  @IsNotEmpty({ message: 'Lý do đổi phòng là bắt buộc' })
  reason: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Giữ nguyên giá phòng cũ (true) hoặc tính lại tiền theo giá phòng mới cho các đêm còn lại (false)',
  })
  @IsOptional()
  @IsBoolean()
  keepPrice?: boolean;
}
