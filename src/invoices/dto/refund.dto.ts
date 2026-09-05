import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class RefundDto {
  @ApiProperty({ example: 500000, description: 'Số tiền hoàn lại cho khách (<= số tiền đã thanh toán)' })
  @IsNumber({}, { message: 'Số tiền hoàn phải là số' })
  @IsPositive({ message: 'Số tiền hoàn phải lớn hơn 0' })
  amount: number;

  @ApiProperty({ example: 'Khách trả phòng sớm 1 đêm', description: 'Lý do hoàn tiền' })
  @IsString()
  @IsNotEmpty({ message: 'Lý do hoàn tiền là bắt buộc' })
  reason: string;
}
