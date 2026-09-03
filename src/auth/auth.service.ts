import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private redisService: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký trong hệ thống');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role || Role.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user,
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
      },
      accessToken: token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new BadRequestException('Không tìm thấy thông tin người dùng');
    }
    return user;
  }

  /**
   * Yêu cầu đặt lại mật khẩu (Gửi mã OTP 6 chữ số về email)
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Nếu email không tồn tại trong hệ thống, vẫn trả về thông báo chung để chống rò rỉ thông tin (User Enumeration Attack)
    if (!user) {
      return {
        success: true,
        message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP xác nhận trong giây lát.',
      };
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản này đã bị khóa. Vui lòng liên hệ ban quản trị.');
    }

    // Đánh dấu tất cả các mã OTP cũ chưa dùng của email này thành đã dùng (invalidated)
    await this.prisma.passwordReset.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // Mã OTP mặc định là 123456 (hoặc lấy từ biến môi trường DEFAULT_OTP)
    const otp = process.env.DEFAULT_OTP || '123456';
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresInMinutes = 15;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Lưu bản ghi vào PostgreSQL
    await this.prisma.passwordReset.create({
      data: {
        email,
        otp,
        token: resetToken,
        expiresAt,
        used: false,
      },
    });

    // Đồng thời lưu vào Redis Cache nếu Redis khả dụng
    if (this.redisService?.isReady) {
      await this.redisService.set(
        `otp:reset:${email}`,
        { otp, resetToken, expiresAt: expiresAt.toISOString() },
        expiresInMinutes * 60,
      );
    }

    // Gửi email chứa mã OTP
    const mailResult = await this.mailService.sendPasswordResetOtp(
      email,
      user.fullName,
      otp,
      expiresInMinutes,
    );

    return {
      success: true,
      message: 'Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 15 phút.',
      email,
      expiresInMinutes,
      ...(mailResult.isDevMock ? { debugOtp: otp } : {}),
    };
  }

  /**
   * Xác thực mã OTP đặt lại mật khẩu (Dành cho flow nhiều bước trên UI)
   */
  async verifyResetOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const otp = dto.otp.trim();

    let resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        email,
        otp,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Hỗ trợ mã OTP mặc định 123456 cho bất kỳ yêu cầu đặt lại mật khẩu hợp lệ
    const defaultOtp = process.env.DEFAULT_OTP || '123456';
    if (!resetRecord && otp === defaultOtp) {
      resetRecord = await this.prisma.passwordReset.findFirst({
        where: {
          email,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!resetRecord) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hiệu lực. Vui lòng thử lại.');
    }

    return {
      success: true,
      message: 'Xác thực mã OTP thành công. Bạn có thể tiến hành đặt lại mật khẩu mới.',
      resetToken: resetRecord.token,
    };
  }

  /**
   * Đặt lại mật khẩu mới bằng (email + OTP) hoặc resetToken
   */
  async resetPassword(dto: ResetPasswordDto) {
    let resetRecord: any = null;

    if (dto.resetToken) {
      resetRecord = await this.prisma.passwordReset.findUnique({
        where: { token: dto.resetToken.trim() },
      });
    } else if (dto.email && dto.otp) {
      const email = dto.email.toLowerCase().trim();
      const otp = dto.otp.trim();
      resetRecord = await this.prisma.passwordReset.findFirst({
        where: {
          email,
          otp,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Hỗ trợ mã OTP mặc định 123456
      const defaultOtp = process.env.DEFAULT_OTP || '123456';
      if (!resetRecord && otp === defaultOtp) {
        resetRecord = await this.prisma.passwordReset.findFirst({
          where: {
            email,
            used: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    } else {
      throw new BadRequestException('Vui lòng cung cấp mã resetToken hoặc cặp thông tin (email, otp).');
    }


    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      throw new BadRequestException('Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: resetRecord.email },
    });

    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản người dùng tương ứng.');
    }

    // Băm mật khẩu mới bằng bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

    // Cập nhật mật khẩu và đánh dấu OTP/token là đã sử dụng
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ]);

    // Xóa cache Redis nếu có
    if (this.redisService?.isReady) {
      await this.redisService.del(`otp:reset:${resetRecord.email}`);
    }

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.',
    };
  }

  private generateToken(userId: string, email: string, role: Role): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}

