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
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function formatDatabaseUrl() {
    let url = process.env.DATABASE_URL;
    if (!url)
        return undefined;
    const isCloudDb = !url.includes('localhost') && !url.includes('127.0.0.1');
    if (isCloudDb && !url.includes('sslmode=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}sslmode=require&connect_timeout=30&pool_timeout=30`;
    }
    return url;
}
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    constructor() {
        const formattedUrl = formatDatabaseUrl();
        super(formattedUrl
            ? {
                datasources: {
                    db: {
                        url: formattedUrl,
                    },
                },
            }
            : undefined);
        this.logger = new common_1.Logger(PrismaService_1.name);
    }
    async onModuleInit() {
        const maxRetries = 5;
        let attempt = 0;
        while (attempt < maxRetries) {
            attempt++;
            try {
                await this.$connect();
                this.logger.log('✅ Kết nối cơ sở dữ liệu PostgreSQL thành công!');
                return;
            }
            catch (error) {
                if (attempt < maxRetries) {
                    this.logger.warn(`⚠️ Lỗi kết nối DB (${error.message}). Đang thử lại lần ${attempt}/${maxRetries} sau 3 giây...`);
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else {
                    this.logger.error(`❌ Không thể kết nối cơ sở dữ liệu PostgreSQL (${error.message}). ` +
                        `Vui lòng kiểm tra biến môi trường DATABASE_URL trong phần Environment của Render/Hosting.`);
                    throw error;
                }
            }
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map