import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Refresh Token cần thu hồi khi đăng xuất khỏi thiết bị hiện tại. Nếu để trống, hệ thống sẽ thu hồi toàn bộ Refresh Token của tài khoản.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString({ message: 'Refresh token phải là chuỗi ký tự' })
  refreshToken?: string;
}
