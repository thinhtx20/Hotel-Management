import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private prisma;
    private redisService;
    constructor(prisma: PrismaService, redisService: RedisService);
    validate(req: Request, payload: {
        sub: string;
        email: string;
        role: string;
        sid?: string;
    }): Promise<{
        id: string;
        email: string;
        fullName: string;
        phone: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
}
export {};
