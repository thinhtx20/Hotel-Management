import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'customer@hotel.com', description: 'Email tài khoản' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email là bắt buộc' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Mật khẩu tối thiểu 6 ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu là bắt buộc' })
  @MinLength(6, { message: 'Mật khẩu phải có tối thiểu 6 ký tự' })
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên' })
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiPropertyOptional({ example: '0912345678', description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.CUSTOMER, description: 'Vai trò (Chỉ Admin mới được cấp quyền đặc biệt)' })
  @IsOptional()
  @IsEnum(Role, { message: 'Vai trò không hợp lệ' })
  role?: Role;
}
