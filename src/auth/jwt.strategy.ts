import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      passReqToCallback: true,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-hotel-jwt-key-2026-change-in-production',
    });
  }

  async validate(req: Request, payload: { sub: string; email: string; role: string }) {
    // Kiểm tra Access Token có nằm trong Blacklist (do đăng xuất) không
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token && this.redisService?.isReady) {
      const isBlacklisted = await this.redisService.get(`auth:blacklist:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Phiên làm việc đã kết thúc do đăng xuất. Vui lòng đăng nhập lại');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị vô hiệu hóa');
    }

    return user;
  }
}

