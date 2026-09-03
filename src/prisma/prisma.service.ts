import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Kết nối cơ sở dữ liệu PostgreSQL thành công!');
    } catch (error: any) {
      this.logger.error(
        `❌ Không thể kết nối cơ sở dữ liệu PostgreSQL (${error.message}). ` +
        `Vui lòng kiểm tra biến môi trường DATABASE_URL trong phần Environment của Render/Hosting.`,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
