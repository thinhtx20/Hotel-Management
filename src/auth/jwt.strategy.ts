import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { isSingleDeviceRole, sessionRevokedException } from './session-policy';

/**
 * Ưu tiên header `Authorization: Bearer <token>`.
 * Chấp nhận thêm `?token=` / `?access_token=` cho các luồng trình duyệt không gửi được header,
 * điển hình là `EventSource` của SSE (`GET /api/v1/users/stream`).
 */
const jwtExtractor = ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  ExtractJwt.fromUrlQueryParameter('token'),
  ExtractJwt.fromUrlQueryParameter('access_token'),
]);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: jwtExtractor,
      passReqToCallback: true,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-hotel-jwt-key-2026-change-in-production',
    });
  }

  async validate(
    req: Request,
    payload: { sub: string; email: string; role: string; sid?: string },
  ) {
    // Kiểm tra Access Token có nằm trong Blacklist (do đăng xuất) không
    const token = jwtExtractor(req);
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
        activeSessionId: true,
        activeDevice: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị vô hiệu hóa');
    }

    // Chốt "1 tài khoản khách hàng - 1 thiết bị": token phải mang đúng mã phiên đang hoạt động.
    // Token cấp trước khi bật tính năng (không có `sid`) cũng bị loại ngay khi tài khoản
    // đã có phiên mới, nên không tồn tại đường vòng nào cho thiết bị cũ.
    if (
      isSingleDeviceRole(user.role) &&
      user.activeSessionId &&
      payload.sid !== user.activeSessionId
    ) {
      throw sessionRevokedException(user.activeDevice);
    }

    const { activeSessionId, activeDevice, ...currentUser } = user;
    return currentUser;
  }
}

