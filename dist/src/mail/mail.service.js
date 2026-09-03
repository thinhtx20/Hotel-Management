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
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
let MailService = MailService_1 = class MailService {
    constructor() {
        this.logger = new common_1.Logger(MailService_1.name);
        this.transporter = null;
        this.isSmtpConfigured = false;
        this.initTransporter();
    }
    initTransporter() {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT) || 587;
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        if (host && user && pass) {
            try {
                this.transporter = nodemailer.createTransport({
                    host,
                    port,
                    secure,
                    auth: { user, pass },
                });
                this.isSmtpConfigured = true;
                this.logger.log(`✅ Khởi tạo SMTP Transporter thành công (${host}:${port})`);
            }
            catch (err) {
                this.logger.warn(`⚠️ Không thể khởi tạo SMTP Transporter: ${err.message}`);
                this.isSmtpConfigured = false;
            }
        }
        else {
            this.logger.log('ℹ️ Chưa cấu hình tài khoản SMTP (SMTP_HOST/USER/PASS). Hệ thống sẽ chạy chế độ mô phỏng gửi email (Dev Log).');
        }
    }
    async sendPasswordResetOtp(toEmail, recipientName, otp, expiresInMinutes = 15) {
        const fromAddress = process.env.SMTP_FROM || '"Hotel Management System" <noreply@hotelmanagement.vn>';
        const subject = `[Hotel Management] Mã xác nhận đặt lại mật khẩu của bạn: ${otp}`;
        const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
          .content { padding: 30px 25px; color: #333333; line-height: 1.6; }
          .otp-badge { display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e3c72; background: #eef3ff; padding: 14px 28px; border-radius: 8px; border: 2px dashed #3a68b8; margin: 20px 0; }
          .alert-box { background-color: #fff8e6; border-left: 4px solid #ffaa00; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #7a5800; border-radius: 4px; }
          .footer { background-color: #f9fbfd; padding: 18px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>HOTEL MANAGEMENT SYSTEM</h1>
          </div>
          <div class="content">
            <p>Xin chào <strong>${recipientName || 'Quý khách'}</strong>,</p>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản đăng ký với email <strong>${toEmail}</strong>.</p>
            <p>Vui lòng sử dụng mã OTP dưới đây để hoàn tất việc xác thực và đặt lại mật khẩu của bạn:</p>
            
            <div style="text-align: center;">
              <div class="otp-badge">${otp}</div>
            </div>
            
            <div class="alert-box">
              ⏱ Mã xác thực này có hiệu lực trong vòng <strong>${expiresInMinutes} phút</strong>.<br>
              🔒 Tuyệt đối không chia sẻ mã này cho bất kỳ ai nhằm bảo đảm an toàn cho tài khoản.
            </div>

            <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ ngay ban quản trị khách sạn để được trợ giúp.</p>
            <p style="margin-top: 25px;">Trân trọng,<br><strong>Đội ngũ Quản lý Khách sạn</strong></p>
          </div>
          <div class="footer">
            Đây là email tự động, vui lòng không trả lời trực tiếp email này. © 2026 Hotel Management System.
          </div>
        </div>
      </body>
      </html>
    `;
        if (!this.isSmtpConfigured || !this.transporter) {
            this.logger.log(`
===========================================================
📩 [DEV EMAIL SIMULATOR] GỬI MÃ OTP ĐẶT LẠI MẬT KHẨU
To: ${toEmail} (${recipientName || 'Người dùng'})
Subject: ${subject}
MÃ OTP XÁC THỰC: [ ${otp} ] (Hiệu lực: ${expiresInMinutes} phút)
===========================================================
      `);
            return { sent: true, isDevMock: true };
        }
        try {
            await this.transporter.sendMail({
                from: fromAddress,
                to: toEmail,
                subject,
                html: htmlContent,
            });
            this.logger.log(`✅ Đã gửi email xác thực OTP tới: ${toEmail}`);
            return { sent: true, isDevMock: false };
        }
        catch (error) {
            this.logger.error(`❌ Gửi email thất bại tới ${toEmail}: ${error.message}`);
            this.logger.warn(`⚠️ [FALLBACK] Mã OTP cho ${toEmail} là: ${otp}`);
            return { sent: false, isDevMock: false };
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailService);
//# sourceMappingURL=mail.service.js.map