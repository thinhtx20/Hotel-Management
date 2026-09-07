import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AdminChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Mật khẩu mới cho tài khoản (tối thiểu 6 ký tự)',
    example: 'Admin@123',
  })
  @IsOptional()
  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  newPassword?: string;

  @ApiPropertyOptional({
    description: 'Mật khẩu mới cho tài khoản (alias cho newPassword)',
    example: 'Admin@123',
  })
  @IsOptional()
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password?: string;
}
