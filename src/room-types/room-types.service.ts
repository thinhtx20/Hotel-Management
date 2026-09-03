import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';

@Injectable()
export class RoomTypesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoomTypeDto) {
    const existing = await this.prisma.roomType.findFirst({
      where: {
        OR: [{ name: dto.name }, { code: dto.code.toUpperCase() }],
      },
    });
    if (existing) {
      throw new ConflictException('Tên hoặc mã loại phòng đã tồn tại');
    }

    return this.prisma.roomType.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        amenities: dto.amenities || [],
        images: dto.images || [],
      },
    });
  }

  async findAll() {
    return this.prisma.roomType.findMany({
      include: {
        _count: {
          select: { rooms: true },
        },
      },
      orderBy: { basePrice: 'asc' },
    });
  }

  async findOne(id: string) {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id },
      include: {
        rooms: true,
      },
    });

    if (!roomType) {
      throw new NotFoundException(`Không tìm thấy loại phòng với ID: ${id}`);
    }

    return roomType;
  }

  async update(id: string, dto: UpdateRoomTypeDto) {
    await this.findOne(id);
    return this.prisma.roomType.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code ? dto.code.toUpperCase() : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.roomType.delete({
      where: { id },
    });
  }
}
