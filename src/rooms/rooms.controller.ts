import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto, UpdateRoomStatusDto } from './dto/update-room.dto';
import { QueryAvailableRoomsDto } from './dto/query-available-rooms.dto';
import { SearchRoomDto } from './dto/search-room.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { Role, RoomStatus } from '@prisma/client';

const SAMPLE_ROOM = {
  id: '3f6c8d20-41ab-4f27-96a8-208935cba48b',
  roomNumber: '101',
  floor: 1,
  status: 'AVAILABLE',
  roomTypeId: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
  roomTypeName: 'Phòng Deluxe Hướng Biển',
  roomTypeCode: 'DELUXE_OCEAN',
  description: 'Phòng cao cấp ngắm trọn bình minh trên biển',
  pricePerNight: 1200000,
  images: [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  ],
  amenities: ['Wifi tốc độ cao', 'Ban công view biển', 'Bồn tắm nằm', 'Smart TV 55 inch'],
  capacityAdults: 2,
  capacityChildren: 1,
  sizeSqM: 38,
};

@ApiTags('Rooms (Quản lý Phòng & Tìm kiếm)')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo phòng mới (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tạo phòng mới thành công',
    exampleData: SAMPLE_ROOM,
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Số phòng 101 đã tồn tại',
    error: 'Conflict',
    path: '/api/v1/rooms',
  })
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.create(createRoomDto);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm phòng Full-Text siêu tốc bằng Elasticsearch (Fuzzy match, tiện ích, khoảng giá)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Tìm kiếm danh sách phòng thành công',
    exampleData: [SAMPLE_ROOM],
  })
  search(@Query() searchDto: SearchRoomDto, @CurrentUser() user?: any) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.search(searchDto, isStaff);
  }

  @Public()
  @Get('available')
  @ApiOperation({ summary: 'Tìm kiếm danh sách phòng trống theo khoảng thời gian đặt phòng (Redis Caching)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách phòng trống thành công',
    exampleData: [SAMPLE_ROOM],
  })
  findAvailable(@Query() query: QueryAvailableRoomsDto, @CurrentUser() user?: any) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.findAvailable(query, isStaff);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả phòng kèm bộ lọc trạng thái/tầng' })
  @ApiQuery({ name: 'status', enum: RoomStatus, required: false })
  @ApiQuery({ name: 'floor', type: Number, required: false })
  @ApiQuery({ name: 'roomTypeId', type: String, required: false })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách tất cả phòng thành công',
    exampleData: [SAMPLE_ROOM],
  })
  findAll(
    @Query('status') status?: RoomStatus,
    @Query('floor') floor?: number,
    @Query('roomTypeId') roomTypeId?: string,
    @CurrentUser() user?: any,
  ) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.findAll(status, floor ? Number(floor) : undefined, roomTypeId, isStaff);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết thông tin một phòng' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xem chi tiết thông tin phòng thành công',
    exampleData: SAMPLE_ROOM,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'Không tìm thấy phòng với ID: 3f6c8d20-41ab-4f27-96a8-208935cba48b',
    error: 'Not Found',
    path: '/api/v1/rooms/3f6c8d20-41ab-4f27-96a8-208935cba48b',
  })
  findOne(@Param('id') id: string, @CurrentUser() user?: any) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.findOne(id, isStaff);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật nhanh trạng thái phòng (Trống, Đang ở, Dọn dẹp, Bảo trì)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật trạng thái phòng thành công',
    exampleData: { ...SAMPLE_ROOM, status: 'CLEANING' },
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.roomsService.updateStatus(id, dto.status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin phòng (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật thông tin phòng thành công',
    exampleData: SAMPLE_ROOM,
  })
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomsService.update(id, updateRoomDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa phòng (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xóa phòng thành công',
    exampleData: { id: '3f6c8d20-41ab-4f27-96a8-208935cba48b', roomNumber: '101' },
  })
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}
