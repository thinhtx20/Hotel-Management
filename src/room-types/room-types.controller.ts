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
  create(@Body() createRoomTypeDto: CreateRoomTypeDto) {
    return this.roomTypesService.create(createRoomTypeDto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách loại phòng và tiện nghi (Công khai)' })
  findAll() {
    return this.roomTypesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một loại phòng (Công khai)' })
  findOne(@Param('id') id: string) {
    return this.roomTypesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật loại phòng và đơn giá (Chỉ Admin)' })
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
  remove(@Param('id') id: string) {
    return this.roomTypesService.remove(id);
  }
}
