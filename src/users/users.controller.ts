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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users (Quản lý người dùng & Nhân sự)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Lấy danh sách người dùng (Admin & Receptionist)' })
  @ApiQuery({ name: 'role', enum: Role, required: false, description: 'Lọc theo vai trò' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách người dùng thành công' })
  findAll(@Query('role') role?: Role) {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Chi tiết người dùng theo ID' })
  @ApiResponse({ status: 200, description: 'Xem thông tin chi tiết người dùng thành công' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin / vai trò người dùng (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin người dùng thành công' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Vô hiệu hóa tài khoản (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Vô hiệu hóa tài khoản người dùng thành công' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
