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
import { Role, RoomStatus } from '@prisma/client';

@ApiTags('Rooms (Quản lý Phòng & Tìm kiếm)')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo phòng mới (Chỉ Admin)' })
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.create(createRoomDto);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm phòng Full-Text siêu tốc bằng Elasticsearch (Fuzzy match, tiện ích, khoảng giá)' })
  search(@Query() searchDto: SearchRoomDto) {
    return this.roomsService.search(searchDto);
  }

  @Public()
  @Get('available')
  @ApiOperation({ summary: 'Tìm kiếm danh sách phòng trống theo khoảng thời gian đặt phòng (Redis Caching)' })
  findAvailable(@Query() query: QueryAvailableRoomsDto) {
    return this.roomsService.findAvailable(query);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả phòng kèm bộ lọc trạng thái/tầng' })
  @ApiQuery({ name: 'status', enum: RoomStatus, required: false })
  @ApiQuery({ name: 'floor', type: Number, required: false })
  @ApiQuery({ name: 'roomTypeId', type: String, required: false })
  findAll(
    @Query('status') status?: RoomStatus,
    @Query('floor') floor?: number,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return this.roomsService.findAll(status, floor ? Number(floor) : undefined, roomTypeId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết thông tin một phòng' })
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật nhanh trạng thái phòng (Trống, Đang ở, Dọn dẹp, Bảo trì)' })
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
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomsService.update(id, updateRoomDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa phòng (Chỉ Admin)' })
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}
