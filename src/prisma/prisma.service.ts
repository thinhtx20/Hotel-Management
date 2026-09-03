import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
        await this.ensureInitialSeed();
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

  private async ensureInitialSeed() {
    try {
      const userCount = await this.user.count();
      if (userCount === 0) {
        this.logger.log('🌱 Phát hiện CSDL chưa có dữ liệu. Đang tự động khởi tạo dữ liệu mẫu ban đầu...');

        const salt = await bcrypt.genSalt(10);
        const adminHash = await bcrypt.hash('Admin@123', salt);
        const staffHash = await bcrypt.hash('Staff@123', salt);
        const custHash = await bcrypt.hash('Cust@123', salt);

        await this.user.createMany({
          data: [
            {
              email: 'admin@hotel.com',
              password: adminHash,
              fullName: 'Quản Trị Viên (Super Admin)',
              phone: '0901112233',
              role: Role.ADMIN,
              isActive: true,
            },
            {
              email: 'reception@hotel.com',
              password: staffHash,
              fullName: 'Lê Thu Hà (Lễ Tân)',
              phone: '0903334455',
              role: Role.RECEPTIONIST,
              isActive: true,
            },
            {
              email: 'cashier@hotel.com',
              password: staffHash,
              fullName: 'Trần Văn Minh (Thu Ngân)',
              phone: '0906667788',
              role: Role.CASHIER,
              isActive: true,
            },
            {
              email: 'customer@hotel.com',
              password: custHash,
              fullName: 'Nguyễn Anh Tuấn (Khách Hàng)',
              phone: '0918889900',
              role: Role.CUSTOMER,
              isActive: true,
            },
          ],
          skipDuplicates: true,
        });

        const roomTypeCount = await this.roomType.count();
        if (roomTypeCount === 0) {
          const std = await this.roomType.create({
            data: {
              name: 'Standard Queen Double',
              code: 'STD-D',
              description: 'Phòng tiêu chuẩn 1 giường đôi Queen, tiện nghi và ấm cúng.',
              basePrice: 650000,
              capacityAdults: 2,
              capacityChildren: 1,
              sizeSqM: 28,
              amenities: ['Wifi tốc độ cao', 'Điều hòa 2 chiều', 'Smart TV 43 inch', 'Minibar mini', 'Máy sấy tóc'],
              images: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80'],
            },
          });

          const dlx = await this.roomType.create({
            data: {
              name: 'Deluxe Ocean Panorama',
              code: 'DLX-OV',
              description: 'Phòng Deluxe view biển thoáng đãng với ban công ngắm hoàng hôn tuyệt đẹp.',
              basePrice: 1250000,
              capacityAdults: 2,
              capacityChildren: 2,
              sizeSqM: 40,
              amenities: ['Ban công view biển', 'Bồn tắm ngắm biển', 'Smart TV 55 inch', 'Máy pha cà phê'],
              images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80'],
            },
          });

          await this.room.createMany({
            data: [
              { roomNumber: '101', floor: 1, roomTypeId: std.id },
              { roomNumber: '102', floor: 1, roomTypeId: std.id },
              { roomNumber: '201', floor: 2, roomTypeId: dlx.id },
              { roomNumber: '202', floor: 2, roomTypeId: dlx.id },
            ],
            skipDuplicates: true,
          });
        }

        this.logger.log('🎉 Khởi tạo dữ liệu mẫu hoàn tất!');
        this.logger.log('👉 ADMIN: admin@hotel.com | Pass: Admin@123 (hoặc admin@123)');
        this.logger.log('👉 RECEPTIONIST: reception@hotel.com | Pass: Staff@123');
        this.logger.log('👉 CASHIER: cashier@hotel.com | Pass: Staff@123');
        this.logger.log('👉 CUSTOMER: customer@hotel.com | Pass: Cust@123');
      } else {
        const adminExists = await this.user.findFirst({
          where: { role: Role.ADMIN },
        });
        if (!adminExists) {
          const salt = await bcrypt.genSalt(10);
          const adminHash = await bcrypt.hash('Admin@123', salt);
          await this.user.create({
            data: {
              email: 'admin@hotel.com',
              password: adminHash,
              fullName: 'Quản Trị Viên (Super Admin)',
              phone: '0901112233',
              role: Role.ADMIN,
              isActive: true,
            },
          });
          this.logger.log('✅ Đã tự động tạo bổ sung tài khoản Admin: admin@hotel.com | Admin@123');
        }
      }
    } catch (err: any) {
      this.logger.warn(`⚠️ Bỏ qua auto-seed (${err.message}). Ứng dụng vẫn hoạt động bình thường.`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
