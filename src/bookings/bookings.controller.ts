import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BookingStatus, Role } from '@prisma/client';

@ApiTags('Bookings (Đặt phòng & Lưu trú)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Đặt phòng mới (Tự động tính tiền & phòng tránh trùng lịch)' })
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.create(createBookingDto, userId, userRole);
  }

  @Get()
  @ApiOperation({ summary: 'Xem danh sách đặt phòng (Hỗ trợ lọc theo trạng thái, khách hàng, phòng)' })
  @ApiQuery({ name: 'status', enum: BookingStatus, required: false })
  @ApiQuery({ name: 'customerId', type: String, required: false })
  @ApiQuery({ name: 'roomId', type: String, required: false })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Query('status') status?: BookingStatus,
    @Query('customerId') customerId?: string,
    @Query('roomId') roomId?: string,
  ) {
    // Nếu là CUSTOMER thì chỉ xem được danh sách đơn đặt của chính mình
    const finalCustomerId = userRole === Role.CUSTOMER ? userId : customerId;
    return this.bookingsService.findAll(status, finalCustomerId, roomId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết đơn đặt phòng' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/check-in')
  @ApiOperation({ summary: 'Check-in khách vào nhận phòng (Chuyển phòng sang OCCUPIED)' })
  checkIn(@Param('id') id: string) {
    return this.bookingsService.checkIn(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @Post(':id/check-out')
  @ApiOperation({ summary: 'Check-out trả phòng, tính tiền dịch vụ và xuất hóa đơn' })
  checkOut(
    @Param('id') id: string,
    @Body() checkOutDto: CheckOutDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.bookingsService.checkOut(id, checkOutDto, cashierId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hủy đơn đặt phòng và giải phóng trạng thái phòng' })
  cancel(@Param('id') id: string) {
    return this.bookingsService.cancel(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/services')
  @ApiOperation({ summary: 'Ghi nhận sử dụng dịch vụ phụ trợ (Minibar, giặt là, ăn uống tại phòng)' })
  addServiceOrder(
    @Param('id') id: string,
    @Body() dto: AddServiceOrderDto,
  ) {
    return this.bookingsService.addServiceOrder(id, dto);
  }
}
