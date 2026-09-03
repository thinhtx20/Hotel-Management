import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResetPasswordDto {
  @ApiPropertyOptional({
    example: 'admin@hotel.com',
    description: 'Email của tài khoản (Bắt buộc nếu xác thực bằng OTP)',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Mã OTP gồm 6 chữ số (Bắt buộc nếu xác thực bằng OTP)',
  })
  @IsOptional()
  @IsString({ message: 'Mã OTP phải là chuỗi' })
  @Length(6, 6, { message: 'Mã OTP phải đúng 6 chữ số' })
  otp?: string;

  @ApiPropertyOptional({
    example: 'd9b7a4c28f1e6a5b...',
    description: 'Mã Token đặt lại mật khẩu (Nhận được sau khi verify OTP)',
  })
  @IsOptional()
  @IsString({ message: 'Token đặt lại mật khẩu phải là chuỗi' })
  resetToken?: string;

  @ApiProperty({
    example: 'NewSecret@2026',
    description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
  })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  newPassword: string;
}
