import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { Role } from '@prisma/client';

const SAMPLE_USER = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  email: 'reception@hotel.com',
  fullName: 'Lê Thu Hà (Lễ Tân)',
  phone: '0903334455',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  role: 'RECEPTIONIST',
  isActive: true,
  createdAt: '2026-09-03T07:00:00.000Z',
};

@ApiTags('Users (Quản lý người dùng & Nhân sự)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật thông tin tài khoản hiện tại (Mục 03 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật hồ sơ thành công',
    exampleData: SAMPLE_USER,
  })
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMeDto,
  ) {
    return this.usersService.updateMe(userId, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Lấy danh sách người dùng (Admin & Receptionist)' })
  @ApiQuery({ name: 'role', enum: Role, required: false, description: 'Lọc theo vai trò' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách người dùng thành công',
    exampleData: [SAMPLE_USER],
  })
  findAll(@Query('role') role?: Role) {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Chi tiết người dùng theo ID' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xem thông tin chi tiết người dùng thành công',
    exampleData: SAMPLE_USER,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'Không tìm thấy người dùng với ID tương ứng',
    error: 'Not Found',
    path: '/api/v1/users/:id',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin / vai trò người dùng (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật thông tin người dùng thành công',
    exampleData: SAMPLE_USER,
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Vô hiệu hóa tài khoản (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Vô hiệu hóa tài khoản người dùng thành công',
    exampleData: { ...SAMPLE_USER, isActive: false },
  })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
