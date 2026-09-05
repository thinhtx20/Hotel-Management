import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEventsService } from './user-events.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private userEvents: UserEventsService,
  ) {}

  /**
   * Admin tạo tài khoản nhân viên với vai trò chỉ định.
   * Khác /auth/register (luôn ép CUSTOMER và không trả về vai trò tùy chọn).
   */
  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký trong hệ thống');
    }

    const hashedPassword = await bcrypt.hash(dto.password, await bcrypt.genSalt(10));

    const created = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: dto.fullName,
        phone: dto.phone,
        avatar: dto.avatar,
        role: dto.role,
        isActive: dto.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Đẩy realtime để danh sách tài khoản đang mở tự thêm dòng mới
    this.userEvents.emitCreated(created);

    return created;
  }

  async findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            room: {
              include: { roomType: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID: ${id}`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.userEvents.emitUpdated(updated);

    return updated;
  }

  async updateMe(id: string, dto: { fullName?: string; phone?: string; avatar?: string }) {
    await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.userEvents.emitUpdated(updated);

    return {
      ...updated,
      avatarUrl: updated.avatar,
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    const deactivated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.userEvents.emitDeactivated(deactivated);

    return deactivated;
  }
}
