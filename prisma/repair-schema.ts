/**
 * Vá cấu trúc bảng cho một database bất kỳ mà KHÔNG cần deploy lại ứng dụng.
 *
 *   npm run db:repair                 -> dùng DATABASE_URL trong .env
 *   DATABASE_URL="postgresql://..." npm run db:repair   -> vá DB trên Render/Neon
 *
 * Dùng khi `prisma db push` báo lỗi mất dữ liệu (ví dụ enum Role còn CASHIER)
 * khiến DB thiếu cột mới và API trả về P2022.
 */
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { syncDatabaseSchema } from '../src/prisma/schema-sync';

const logger = new Logger('SchemaRepair');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    logger.log('✅ Đã kết nối cơ sở dữ liệu, bắt đầu vá cấu trúc bảng...');
    await syncDatabaseSchema((sql) => prisma.$executeRawUnsafe(sql), logger);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error(`❌ Vá cấu trúc bảng thất bại: ${err.message}`);
  process.exit(1);
});
