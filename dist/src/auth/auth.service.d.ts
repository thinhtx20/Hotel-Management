import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private mailService;
    private redisService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, mailService: MailService, redisService: RedisService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: number;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: number;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
            role: import(".prisma/client").$Enums.Role;
        };
    }>;
    getProfile(userId: string): Promise<{
        id: string;
        email: string;
        fullName: string;
        phone: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        success: boolean;
        message: string;
    } | {
        debugOtp?: string;
        success: boolean;
        message: string;
        email: string;
        expiresInMinutes: number;
    }>;
    verifyResetOtp(dto: VerifyOtpDto): Promise<{
        success: boolean;
        message: string;
        resetToken: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
    refreshToken(dto: RefreshTokenDto): Promise<{
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
            role: import(".prisma/client").$Enums.Role;
        };
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: number;
    }>;
    logout(userId: string, refreshToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private generateTokens;
    private parseExpiresInToSeconds;
    private generateToken;
}
