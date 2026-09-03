import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function formatDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Nếu là database cloud (như Render, Neon, Supabase...) và chưa có cấu hình sslmode
  const isCloudDb = !url.includes('localhost') && !url.includes('127.0.0.1');
  if (isCloudDb && !url.includes('sslmode=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}sslmode=require&connect_timeout=30&pool_timeout=30`;
  }
  return url;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const formattedUrl = formatDatabaseUrl();
    super(
      formattedUrl
        ? {
            datasources: {
              db: {
                url: formattedUrl,
              },
            },
          }
        : undefined,
    );
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
      } catch (error: any) {
        if (attempt < maxRetries) {
          this.logger.warn(
            `⚠️ Lỗi kết nối DB (${error.message}). Đang thử lại lần ${attempt}/${maxRetries} sau 3 giây...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          this.logger.error(
            `❌ Không thể kết nối cơ sở dữ liệu PostgreSQL (${error.message}). ` +
              `Vui lòng kiểm tra biến môi trường DATABASE_URL trong phần Environment của Render/Hosting.`,
          );
          throw error;
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
