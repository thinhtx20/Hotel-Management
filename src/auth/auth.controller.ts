import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Đăng ký tài khoản thành công',
    exampleData: {
      user: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        email: 'customer@hotel.com',
        fullName: 'Nguyễn Văn Khách Hàng',
        phone: '0912345678',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        role: 'CUSTOMER',
        createdAt: '2026-09-03T07:00:00.000Z',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      expiresIn: '1h',
    },
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Email này đã được đăng ký trong hệ thống',
    error: 'Conflict',
    path: '/api/v1/auth/register',
  })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập hệ thống' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đăng nhập thành công',
    exampleData: {
      user: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        email: 'admin@hotel.com',
        fullName: 'Quản Trị Viên (Super Admin)',
        phone: '0901112233',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        role: 'ADMIN',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      expiresIn: '1h',
    },
  })
  @ApiErrorResponse({
    status: 401,
    message: 'Email hoặc mật khẩu không chính xác',
    error: 'Unauthorized',
    path: '/api/v1/auth/login',
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Làm mới token thành công',
    exampleData: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      expiresIn: '1h',
      user: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        email: 'admin@hotel.com',
        fullName: 'Quản Trị Viên (Super Admin)',
        phone: '0901112233',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        role: 'ADMIN',
      },
    },
  })
  @ApiErrorResponse({
    status: 401,
    message: 'Refresh token không hợp lệ hoặc đã hết hạn',
    error: 'Unauthorized',
    path: '/api/v1/auth/refresh-token',
  })
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Yêu cầu quên mật khẩu (Gửi mã OTP qua email)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đã gửi mã OTP về email (hoặc ghi log dev)',
    message: 'Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 15 phút.',
    exampleData: {
      success: true,
      message: 'Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 15 phút.',
      email: 'customer@hotel.com',
      expiresInMinutes: 15,
      debugOtp: '123456',
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'email phải đúng định dạng',
    error: 'Bad Request',
    path: '/api/v1/auth/forgot-password',
  })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('verify-reset-otp')
  @ApiOperation({ summary: 'Xác thực mã OTP để lấy resetToken' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xác thực mã OTP thành công',
    message: 'Xác thực mã OTP thành công. Bạn có thể đặt mật khẩu mới ngay bây giờ.',
    exampleData: {
      success: true,
      message: 'Xác thực mã OTP thành công. Bạn có thể đặt mật khẩu mới ngay bây giờ.',
      resetToken: 'a1b2c3d4e5f678901234567890abcdef...',
      email: 'customer@hotel.com',
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Mã OTP không chính xác hoặc đã hết hạn',
    error: 'Bad Request',
    path: '/api/v1/auth/verify-reset-otp',
  })
  verifyResetOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyResetOtp(verifyOtpDto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu mới (Bằng resetToken hoặc cặp email + OTP)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đặt lại mật khẩu thành công',
    message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
    exampleData: {
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Thông tin xác thực không hợp lệ hoặc đã hết hạn',
    error: 'Bad Request',
    path: '/api/v1/auth/reset-password',
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy thông tin tài khoản thành công',
    exampleData: {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      email: 'admin@hotel.com',
      fullName: 'Quản Trị Viên (Super Admin)',
      phone: '0901112233',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-09-03T07:00:00.000Z',
    },
  })
  @ApiErrorResponse({
    status: 401,
    message: 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn',
    error: 'Unauthorized',
    path: '/api/v1/auth/me',
  })
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiOperation({ summary: 'Đổi mật khẩu cho người dùng hiện tại (Mục 03 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đổi mật khẩu thành công',
    message: 'Đổi mật khẩu thành công',
    exampleData: {
      success: true,
      message: 'Đổi mật khẩu thành công',
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Mật khẩu hiện tại không chính xác',
    error: 'Bad Request',
    path: '/api/v1/auth/change-password',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất tài khoản và thu hồi token' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đăng xuất thành công',
    message: 'Đăng xuất thành công',
    exampleData: {
      success: true,
      message: 'Đăng xuất thành công',
    },
  })
  logout(
    @CurrentUser('id') userId: string,
    @Body() body?: Partial<RefreshTokenDto>,
  ) {
    return this.authService.logout(userId, body?.refreshToken);
  }
}
