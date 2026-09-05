import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateServiceOrderStatusDto {
  @ApiProperty({ example: 'CONFIRMED', enum: ['CONFIRMED', 'REJECTED'], description: 'Trạng thái xử lý yêu cầu' })
  @IsString()
  @IsIn(['CONFIRMED', 'REJECTED'], { message: 'Trạng thái phải là CONFIRMED hoặc REJECTED' })
  status: 'CONFIRMED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Đã phục vụ xong tại phòng', description: 'Ghi chú phản hồi của nhân viên' })
  @IsOptional()
  @IsString()
  note?: string;
}
