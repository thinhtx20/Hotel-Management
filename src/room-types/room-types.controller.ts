import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { Role } from '@prisma/client';

const SAMPLE_ROOM_TYPE = {
  id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
  name: 'Phòng Deluxe Hướng Biển',
  code: 'DELUXE_OCEAN',
  description: 'Phòng cao cấp ngắm trọn bình minh trên biển',
  basePrice: 1200000,
  capacityAdults: 2,
  capacityChildren: 1,
  sizeSqM: 38,
  amenities: ['Wifi tốc độ cao', 'Ban công view biển', 'Bồn tắm nằm', 'Smart TV 55 inch'],
  images: [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  ],
  createdAt: '2026-09-03T07:00:00.000Z',
  updatedAt: '2026-09-03T07:00:00.000Z',
};

@ApiTags('Room Types (Loại phòng & Giá)')
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo loại phòng mới (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tạo loại phòng mới thành công',
    exampleData: SAMPLE_ROOM_TYPE,
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Tên hoặc mã loại phòng đã tồn tại trong hệ thống',
    error: 'Conflict',
    path: '/api/v1/room-types',
  })
  create(@Body() createRoomTypeDto: CreateRoomTypeDto) {
    return this.roomTypesService.create(createRoomTypeDto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách loại phòng và tiện nghi (Công khai)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách loại phòng thành công',
    exampleData: [SAMPLE_ROOM_TYPE],
  })
  findAll() {
    return this.roomTypesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một loại phòng (Công khai)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy chi tiết loại phòng thành công',
    exampleData: SAMPLE_ROOM_TYPE,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'Không tìm thấy loại phòng với ID tương ứng',
    error: 'Not Found',
    path: '/api/v1/room-types/:id',
  })
  findOne(@Param('id') id: string) {
    return this.roomTypesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật loại phòng và đơn giá (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật loại phòng thành công',
    exampleData: SAMPLE_ROOM_TYPE,
  })
  update(
    @Param('id') id: string,
    @Body() updateRoomTypeDto: UpdateRoomTypeDto,
  ) {
    return this.roomTypesService.update(id, updateRoomTypeDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa loại phòng (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xóa loại phòng thành công',
    exampleData: { id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564' },
  })
  remove(@Param('id') id: string) {
    return this.roomTypesService.remove(id);
  }
}
