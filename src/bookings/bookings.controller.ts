import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { ApproveBookingDto, RejectBookingDto } from './dto/approve-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { BookingStatus, Role } from '@prisma/client';

const SAMPLE_BOOKING = {
  id: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
  bookingCode: 'BK-2026-0829',
  customerId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  roomId: '3f6c8d20-41ab-4f27-96a8-208935cba48b',
  checkInDate: '2026-09-05T14:00:00.000Z',
  checkOutDate: '2026-09-08T12:00:00.000Z',
  actualCheckIn: null,
  actualCheckOut: null,
  guestCount: 2,
  totalAmount: 3600000,
  depositAmount: 1000000,
  status: 'CONFIRMED',
  specialRequests: 'Nhận phòng tầng cao, yên tĩnh',
  createdAt: '2026-09-03T07:00:00.000Z',
  room: {
    roomNumber: '101',
    floor: 1,
    roomType: {
      name: 'Phòng Deluxe Hướng Biển',
      basePrice: 1200000,
    },
  },
  customer: {
    fullName: 'Nguyễn Văn Khách Hàng',
    phone: '0912345678',
    email: 'customer@hotel.com',
  },
};

@ApiTags('Bookings (Đặt phòng & Lưu trú)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Đặt phòng mới (Tự động tính tiền & phòng tránh trùng lịch)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Đặt phòng thành công',
    exampleData: SAMPLE_BOOKING,
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Phòng này đã có khách đặt hoặc đang có người lưu trú trong khoảng thời gian đã chọn',
    error: 'Conflict',
    path: '/api/v1/bookings',
  })
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
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách đặt phòng thành công',
    exampleData: [SAMPLE_BOOKING],
  })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Query('status') status?: BookingStatus,
    @Query('customerId') customerId?: string,
    @Query('roomId') roomId?: string,
  ) {
    const finalCustomerId = userRole === Role.CUSTOMER ? userId : customerId;
    return this.bookingsService.findAll(status, finalCustomerId, roomId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết đơn đặt phòng' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy thông tin chi tiết đơn đặt phòng thành công',
    exampleData: SAMPLE_BOOKING,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'Không tìm thấy đơn đặt phòng với ID tương ứng',
    error: 'Not Found',
    path: '/api/v1/bookings/:id',
  })
  @ApiErrorResponse({
    status: 403,
    message: 'Bạn chỉ có thể xem và thao tác trên đơn đặt phòng của chính mình',
    error: 'Forbidden',
    path: '/api/v1/bookings/:id',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.findOne(id, userId, userRole);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Lễ tân/Admin phê duyệt đơn đặt phòng và xác nhận tiền cọc',
    description:
      'Chuyển đơn từ PENDING sang CONFIRMED. Nếu có tiền cọc (depositAmount), tự động tạo/cập nhật hóa đơn cọc ' +
      'và chuyển trạng thái phòng sang RESERVED (Cam hổ phách).',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
    exampleData: {
      message: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
      depositAmount: 500000,
      booking: { ...SAMPLE_BOOKING, status: 'CONFIRMED', depositAmount: 500000 },
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Đơn đặt phòng này đã được phê duyệt trước đó hoặc đã bị hủy',
    error: 'Bad Request',
    path: '/api/v1/bookings/:id/approve',
  })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveBookingDto,
    @CurrentUser('id') receptionistId: string,
  ) {
    return this.bookingsService.approve(id, dto, receptionistId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Lễ tân/Admin phê duyệt đơn đặt phòng (POST alias)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
    exampleData: {
      message: 'Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công',
      depositAmount: 500000,
      booking: { ...SAMPLE_BOOKING, status: 'CONFIRMED', depositAmount: 500000 },
    },
  })
  approvePost(
    @Param('id') id: string,
    @Body() dto: ApproveBookingDto,
    @CurrentUser('id') receptionistId: string,
  ) {
    return this.bookingsService.approve(id, dto, receptionistId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Lễ tân/Admin từ chối đơn đặt phòng mà khách đặt trước' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Từ chối đơn đặt phòng thành công',
    exampleData: {
      message: 'Từ chối đơn đặt phòng thành công',
      booking: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
    },
  })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser('id') receptionistId: string,
  ) {
    return this.bookingsService.reject(id, dto, receptionistId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/reject')
  @ApiOperation({ summary: 'Lễ tân/Admin từ chối đơn đặt phòng (POST alias)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Từ chối đơn đặt phòng thành công',
    exampleData: {
      message: 'Từ chối đơn đặt phòng thành công',
      booking: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
    },
  })
  rejectPost(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser('id') receptionistId: string,
  ) {
    return this.bookingsService.reject(id, dto, receptionistId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/check-in')
  @ApiOperation({ summary: 'Check-in khách vào nhận phòng (Chuyển phòng sang OCCUPIED)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Check-in nhận phòng thành công',
    exampleData: { ...SAMPLE_BOOKING, status: 'CHECKED_IN', actualCheckIn: '2026-09-05T14:10:00.000Z' },
  })
  checkIn(@Param('id') id: string) {
    return this.bookingsService.checkIn(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @Post(':id/check-out')
  @ApiOperation({ summary: 'Check-out trả phòng, tính tiền dịch vụ và xuất hóa đơn' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Check-out và xuất hóa đơn thành công',
    exampleData: {
      booking: { ...SAMPLE_BOOKING, status: 'CHECKED_OUT', actualCheckOut: '2026-09-08T11:45:00.000Z' },
      invoice: {
        id: 'inv-1234',
        invoiceCode: 'INV-2026-0045',
        roomAmount: 3600000,
        servicesAmount: 250000,
        finalAmount: 3850000,
        paidAmount: 1000000,
        paymentStatus: 'PARTIAL',
      },
    },
  })
  checkOut(
    @Param('id') id: string,
    @Body() checkOutDto: CheckOutDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.bookingsService.checkOut(id, checkOutDto, cashierId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hủy đơn đặt phòng và giải phóng trạng thái phòng' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Hủy đơn đặt phòng thành công',
    exampleData: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
  })
  cancel(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.cancel(id, userId, userRole);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Hủy đơn đặt phòng (PATCH alias cho client Flutter)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Hủy đơn đặt phòng thành công',
    exampleData: { ...SAMPLE_BOOKING, status: 'CANCELLED' },
  })
  cancelPatch(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.cancel(id, userId, userRole);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/services')
  @ApiOperation({ summary: 'Ghi nhận sử dụng dịch vụ phụ trợ (Minibar, giặt là, ăn uống tại phòng)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Thêm dịch vụ phụ trợ vào phòng thành công',
    exampleData: {
      id: 'srv-123',
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      serviceName: 'Nước ngọt lon Coca & Giặt là áo sơ mi',
      quantity: 2,
      unitPrice: 50000,
      totalPrice: 100000,
      orderedAt: '2026-09-03T07:00:00.000Z',
    },
  })
  addServiceOrder(
    @Param('id') id: string,
    @Body() dto: AddServiceOrderDto,
  ) {
    return this.bookingsService.addServiceOrder(id, dto);
  }
}
