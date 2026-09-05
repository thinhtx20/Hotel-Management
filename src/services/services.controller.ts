import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { Public } from '../common/decorators/public.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success-response.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateHotelServiceDto } from './dto/create-hotel-service.dto';
import { UpdateHotelServiceDto } from './dto/update-hotel-service.dto';

const SAMPLE_SERVICE = {
  id: 'svc-001',
  code: 'LAUNDRY',
  name: 'Giặt là cao cấp',
  category: 'CONVENIENCE',
  description: 'Giặt ủi quần áo lấy trong ngày, đóng gói cẩn thận',
  unitPrice: 50000,
  unit: 'món',
  icon: 'local_laundry_service',
  isAvailable: true,
};

@ApiTags('Services (Danh mục Dịch vụ Khách sạn)')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Danh mục dịch vụ gia tăng của khách sạn (Công khai cho khách vãng lai)',
  })
  @ApiQuery({
    name: 'all',
    required: false,
    type: Boolean,
    description: 'Lấy cả các dịch vụ đang tạm ngưng (dành cho quản trị)',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Danh sách các dịch vụ khách sạn có sẵn',
    exampleData: [SAMPLE_SERVICE],
  })
  findAll(@Query('all') all?: string) {
    const includeUnavailable = all === 'true' || all === '1';
    return this.servicesService.findAll(includeUnavailable);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết dịch vụ theo ID' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy thông tin dịch vụ thành công',
    exampleData: SAMPLE_SERVICE,
  })
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo mới dịch vụ vào danh mục (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tạo dịch vụ mới thành công',
    exampleData: SAMPLE_SERVICE,
  })
  create(@Body() dto: CreateHotelServiceDto) {
    return this.servicesService.create(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật dịch vụ, đơn giá hoặc trạng thái (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật dịch vụ thành công',
    exampleData: SAMPLE_SERVICE,
  })
  update(@Param('id') id: string, @Body() dto: UpdateHotelServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa dịch vụ khỏi danh mục (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xóa dịch vụ thành công',
    exampleData: { message: 'Đã xóa dịch vụ thành công' },
  })
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
