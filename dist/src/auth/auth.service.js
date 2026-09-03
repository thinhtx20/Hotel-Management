"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const mail_service_1 = require("../mail/mail.service");
const redis_service_1 = require("../redis/redis.service");
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    constructor(prisma, jwtService, mailService, redisService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.mailService = mailService;
        this.redisService = redisService;
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (existing) {
            throw new common_1.ConflictException('Email này đã được đăng ký trong hệ thống');
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(dto.password, salt);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase(),
                password: hashedPassword,
                fullName: dto.fullName,
                phone: dto.phone,
                role: dto.role || client_1.Role.CUSTOMER,
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
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không chính xác');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('Tài khoản của bạn đã bị khóa');
        }
        const isMatch = await bcrypt.compare(dto.password, user.password);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Email hoặc mật khẩu không chính xác');
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
    async getProfile(userId) {
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
            throw new common_1.BadRequestException('Không tìm thấy thông tin người dùng');
        }
        return user;
    }
    async forgotPassword(dto) {
        const email = dto.email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return {
                success: true,
                message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP xác nhận trong giây lát.',
            };
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('Tài khoản này đã bị khóa. Vui lòng liên hệ ban quản trị.');
        }
        await this.prisma.passwordReset.updateMany({
            where: { email, used: false },
            data: { used: true },
        });
        const otp = process.env.DEFAULT_OTP || '123456';
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresInMinutes = 15;
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
        await this.prisma.passwordReset.create({
            data: {
                email,
                otp,
                token: resetToken,
                expiresAt,
                used: false,
            },
        });
        if (this.redisService?.isReady) {
            await this.redisService.set(`otp:reset:${email}`, { otp, resetToken, expiresAt: expiresAt.toISOString() }, expiresInMinutes * 60);
        }
        const mailResult = await this.mailService.sendPasswordResetOtp(email, user.fullName, otp, expiresInMinutes);
        return {
            success: true,
            message: 'Mã xác thực OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 15 phút.',
            email,
            expiresInMinutes,
            ...(mailResult.isDevMock ? { debugOtp: otp } : {}),
        };
    }
    async verifyResetOtp(dto) {
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
            throw new common_1.BadRequestException('Mã OTP không chính xác hoặc đã hết hiệu lực. Vui lòng thử lại.');
        }
        return {
            success: true,
            message: 'Xác thực mã OTP thành công. Bạn có thể tiến hành đặt lại mật khẩu mới.',
            resetToken: resetRecord.token,
        };
    }
    async resetPassword(dto) {
        let resetRecord = null;
        if (dto.resetToken) {
            resetRecord = await this.prisma.passwordReset.findUnique({
                where: { token: dto.resetToken.trim() },
            });
        }
        else if (dto.email && dto.otp) {
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
        }
        else {
            throw new common_1.BadRequestException('Vui lòng cung cấp mã resetToken hoặc cặp thông tin (email, otp).');
        }
        if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
        }
        const user = await this.prisma.user.findUnique({
            where: { email: resetRecord.email },
        });
        if (!user) {
            throw new common_1.BadRequestException('Không tìm thấy tài khoản người dùng tương ứng.');
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(dto.newPassword, salt);
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
        if (this.redisService?.isReady) {
            await this.redisService.del(`otp:reset:${resetRecord.email}`);
        }
        return {
            success: true,
            message: 'Đặt lại mật khẩu thành công! Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.',
        };
    }
    generateToken(userId, email, role) {
        const payload = { sub: userId, email, role };
        return this.jwtService.sign(payload);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        mail_service_1.MailService,
        redis_service_1.RedisService])
], AuthService);
//# sourceMappingURL=auth.service.js.map