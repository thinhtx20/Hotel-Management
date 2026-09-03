import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
        };
        accessToken: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
            role: import(".prisma/client").$Enums.Role;
        };
        accessToken: string;
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
        id: string;
        email: string;
        fullName: string;
        phone: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
    }>;
}
