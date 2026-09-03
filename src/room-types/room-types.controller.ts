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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '@prisma/client';

@ApiTags('Room Types (Loại phòng & Giá)')
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo loại phòng mới (Chỉ Admin)' })
  @ApiResponse({ status: 201, description: 'Tạo loại phòng mới thành công' })
  create(@Body() createRoomTypeDto: CreateRoomTypeDto) {
    return this.roomTypesService.create(createRoomTypeDto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách loại phòng và tiện nghi (Công khai)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách loại phòng thành công' })
  findAll() {
    return this.roomTypesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một loại phòng (Công khai)' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết loại phòng thành công' })
  findOne(@Param('id') id: string) {
    return this.roomTypesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật loại phòng và đơn giá (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Cập nhật loại phòng thành công' })
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
  @ApiResponse({ status: 200, description: 'Xóa loại phòng thành công' })
  remove(@Param('id') id: string) {
    return this.roomTypesService.remove(id);
  }
}
