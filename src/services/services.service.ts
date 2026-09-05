import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHotelServiceDto } from './dto/create-hotel-service.dto';
import { UpdateHotelServiceDto } from './dto/update-hotel-service.dto';

export interface HotelServiceItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  unitPrice: number;
  unit: string;
  icon: string | null;
  isAvailable: boolean;
}

const DEFAULT_SERVICES: Array<Omit<HotelServiceItem, 'id'>> = [
  {
    code: 'LAUNDRY',
    name: 'Giặt là cao cấp',
    category: 'CONVENIENCE',
    description: 'Giặt ủi quần áo lấy trong ngày, đóng gói cẩn thận',
    unitPrice: 50000,
    unit: 'món',
    icon: 'local_laundry_service',
    isAvailable: true,
  },
  {
    code: 'MINIBAR',
    name: 'Minibar trọn gói',
    category: 'FOOD_BEVERAGE',
    description: 'Bao gồm snack cao cấp, nước ngọt, bia và nước khoáng hảo hạng',
    unitPrice: 150000,
    unit: 'combo',
    icon: 'kitchen',
    isAvailable: true,
  },
  {
    code: 'BREAKFAST',
    name: 'Ăn sáng buffet tại phòng',
    category: 'FOOD_BEVERAGE',
    description: 'Phục vụ bữa sáng tiêu chuẩn 5 sao tận phòng ngủ theo yêu cầu',
    unitPrice: 200000,
    unit: 'suất',
    icon: 'restaurant',
    isAvailable: true,
  },
  {
    code: 'AIRPORT_TRANSFER',
    name: 'Đưa đón sân bay',
    category: 'TRANSPORT',
    description: 'Xe Sedona / Mercedes đời mới đưa đón 2 chiều sân bay tiện lợi',
    unitPrice: 350000,
    unit: 'lượt',
    icon: 'airport_shuttle',
    isAvailable: true,
  },
  {
    code: 'SPA_MASSAGE',
    name: 'Spa & Massage trị liệu',
    category: 'WELLNESS',
    description: 'Gói massage tinh dầu thảo dược thư giãn toàn thân 60 phút',
    unitPrice: 500000,
    unit: 'buổi',
    icon: 'spa',
    isAvailable: true,
  },
  {
    code: 'MOTORBIKE_RENTAL',
    name: 'Thuê xe máy tay ga',
    category: 'TRANSPORT',
    description: 'Xe tay ga đời mới, kèm 2 mũ bảo hiểm đạt chuẩn an toàn',
    unitPrice: 150000,
    unit: 'ngày',
    icon: 'two_wheeler',
    isAvailable: true,
  },
  {
    code: 'AFTERNOON_TEA',
    name: 'Trà chiều hoàng gia',
    category: 'ROOM_SERVICE',
    description: 'Set bánh ngọt Pháp và trà Earl Grey thượng hạng cho 2 người',
    unitPrice: 180000,
    unit: 'set',
    icon: 'emoji_food_beverage',
    isAvailable: true,
  },
];

@Injectable()
export class ServicesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureInitialServices();
    } catch {
      // Bỏ qua lỗi kết nối CSDL trong giai đoạn khởi động (nếu DB chưa sẵn sàng)
    }
  }

  async ensureInitialServices() {
    const count = await this.prisma.hotelService.count();
    if (count === 0) {
      for (const svc of DEFAULT_SERVICES) {
        await this.prisma.hotelService.upsert({
          where: { code: svc.code },
          create: svc,
          update: {},
        });
      }
    }
  }

  async findAll(includeUnavailable = false) {
    await this.ensureInitialServices().catch(() => {});
    return this.prisma.hotelService.findMany({
      where: includeUnavailable ? undefined : { isAvailable: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.hotelService.findUnique({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID: ${id}`);
    }
    return service;
  }

  async findByCode(code: string) {
    return this.prisma.hotelService.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  async create(dto: CreateHotelServiceDto) {
    const existing = await this.prisma.hotelService.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Dịch vụ với mã ${dto.code} đã tồn tại`);
    }

    return this.prisma.hotelService.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        unit: dto.unit || 'lần',
        isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : true,
      },
    });
  }

  async update(id: string, dto: UpdateHotelServiceDto) {
    await this.findOne(id);

    if (dto.code) {
      const codeUpper = dto.code.toUpperCase();
      const existing = await this.prisma.hotelService.findFirst({
        where: { code: codeUpper, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Mã dịch vụ ${dto.code} đã được sử dụng`);
      }
      dto.code = codeUpper;
    }

    return this.prisma.hotelService.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.hotelService.delete({
      where: { id },
    });
  }
}
