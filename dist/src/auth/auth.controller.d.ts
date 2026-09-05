import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    private deviceOf;
    register(registerDto: RegisterDto, req?: Request): Promise<{
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
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
        };
    }>;
    login(loginDto: LoginDto, req?: Request): Promise<{
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
    refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{
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
    forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{
        success: boolean;
        message: string;
    } | {
        debugOtp?: string;
        success: boolean;
        message: string;
        email: string;
        expiresInMinutes: number;
    }>;
    verifyResetOtp(verifyOtpDto: VerifyOtpDto): Promise<{
        success: boolean;
        message: string;
        resetToken: string;
    }>;
    resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
    getProfile(userId: string): Promise<{
        avatarUrl: string;
        stats: {
            totalBookings: number;
            activeBookings: number;
            averageRating: number;
        };
        id: string;
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
    }>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
    logout(userId?: string, dto?: LogoutDto, req?: Request): Promise<{
        success: boolean;
        message: string;
    }>;
}
