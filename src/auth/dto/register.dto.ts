import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Đăng ký công khai: KHÔNG nhận `role`.
 * Server luôn ép vai trò CUSTOMER, nếu không bất kỳ ai cũng có thể tự đăng ký làm ADMIN.
 * Admin tạo tài khoản nhân viên (RECEPTIONIST / ADMIN) qua POST /users.
 */
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

  /**
   * Vẫn được chấp nhận để client cũ không bị lỗi 400 (ValidationPipe đang bật
   * forbidNonWhitelisted), nhưng giá trị gửi lên bị BỎ QUA hoàn toàn.
   */
  @ApiPropertyOptional({
    deprecated: true,
    example: 'CUSTOMER',
    description:
      'ĐÃ BỊ BỎ QUA. Tài khoản đăng ký công khai luôn là CUSTOMER. ' +
      'Để tạo tài khoản nhân viên, Admin dùng POST /users.',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
