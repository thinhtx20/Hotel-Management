import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'admin@hotel.com',
    description: 'Email của tài khoản cần xác thực mã OTP',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Mã OTP gồm 6 chữ số gửi qua email',
  })
  @IsString({ message: 'Mã OTP phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @Length(6, 6, { message: 'Mã OTP phải đúng 6 chữ số' })
  otp: string;
}
