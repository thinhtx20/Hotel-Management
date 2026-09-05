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
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserEventsService } from '../users/user-events.service';
import { DeviceInfo } from './session-policy';
export declare class AuthService {
    private prisma;
    private jwtService;
    private mailService;
    private redisService;
    private userEvents;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, mailService: MailService, redisService: RedisService, userEvents: UserEventsService);
    register(dto: RegisterDto, device?: DeviceInfo): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: number;
        user: {
            id: string;
            createdAt: Date;
            email: string;
            fullName: string;
            phone: string;
            avatar: string;
            role: import(".prisma/client").$Enums.Role;
        };
    }>;
    login(dto: LoginDto, device?: DeviceInfo): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: number;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
            avatar: string;
            avatarUrl: string;
            role: import(".prisma/client").$Enums.Role;
        };
    }>;
    private openDeviceSession;
    private closeDeviceSession;
    private isSessionStillAlive;
    getProfile(userId: string): Promise<{
        avatarUrl: string;
        stats: {
            totalBookings: number;
            activeBookings: number;
            averageRating: number;
        };
        id: string;
        createdAt: Date;
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        success: boolean;
        message: string;
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
            avatar: string;
            avatarUrl: string;
            role: import(".prisma/client").$Enums.Role;
        };
        accessToken: string;
        refreshToken: string;
        tokenType: string;
        expiresIn: number;
    }>;
    logout(userId?: string, refreshToken?: string, accessToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private generateTokens;
    private parseExpiresInToSeconds;
    private generateToken;
}
