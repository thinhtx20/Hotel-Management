import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Admin tạo tài khoản nhân viên (POST /users).
 * Đây là đường duy nhất cấp được vai trò khác CUSTOMER — /auth/register công khai
 * luôn ép CUSTOMER nên không dùng để tạo nhân sự được.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'reception.evening@hotel.com', description: 'Email đăng nhập' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email là bắt buộc' })
  email: string;

  @ApiProperty({ example: 'Staff@123', description: 'Mật khẩu tối thiểu 6 ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu là bắt buộc' })
  @MinLength(6, { message: 'Mật khẩu phải có tối thiểu 6 ký tự' })
  password: string;

  @ApiProperty({ example: 'Đỗ Minh Khoa (Lễ tân ca chiều)', description: 'Họ và tên nhân viên' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiProperty({
    enum: Role,
    example: Role.RECEPTIONIST,
    description: 'Vai trò được cấp: ADMIN, RECEPTIONIST, CASHIER hoặc CUSTOMER',
  })
  @IsEnum(Role, { message: 'Vai trò không hợp lệ' })
  role: Role;

  @ApiPropertyOptional({ example: '0909112233', description: 'Số điện thoại liên hệ' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'Ảnh đại diện' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Kích hoạt tài khoản ngay' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
