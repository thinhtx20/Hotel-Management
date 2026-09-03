export declare class MailService {
    private readonly logger;
    private transporter;
    private isSmtpConfigured;
    constructor();
    private initTransporter;
    sendPasswordResetOtp(toEmail: string, recipientName: string, otp: string, expiresInMinutes?: number): Promise<{
        sent: boolean;
        isDevMock: boolean;
    }>;
}
