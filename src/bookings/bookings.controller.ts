import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { ApproveBookingDto, RejectBookingDto } from './dto/approve-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { RequestServiceDto } from './dto/request-service.dto';
import { UpdateServiceOrderStatusDto } from './dto/update-service-order-status.dto';
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
  status: 'PENDING',
  specialRequests: 'Nhận phòng tầng cao, yên tĩnh',
  confirmedAt: null,
  confirmedBy: null,
  confirmationNote: null,
  cancellationReason: null,
  cancelledAt: null,
  cancelledBy: null,
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

const CANCELLED_BOOKING_SAMPLE = {
  ...SAMPLE_BOOKING,
  status: 'CANCELLED',
  cancellationReason: 'Khách báo bận công tác đột xuất, xin hủy phòng',
  cancelledAt: '2026-09-04T03:20:00.000Z',
  cancelledBy: {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    fullName: 'Nguyễn Văn Khách Hàng',
    role: 'CUSTOMER',
  },
};

@ApiTags('Bookings (Đặt phòng & Lưu trú)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Đặt phòng mới (Tự động tính tiền & phòng tránh trùng lịch)',
    description:
      'Khách hàng (CUSTOMER) tự đặt luôn tạo đơn ở trạng thái PENDING để lễ tân xác nhận qua ' +
      'PATCH /bookings/{id}/confirm. Chỉ ADMIN / RECEPTIONIST mới được truyền status để tạo thẳng đơn CONFIRMED.',
  })
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
  @ApiOperation({
    summary: 'Xem danh sách đặt phòng (Lọc theo trạng thái, khoảng ngày, tìm kiếm, phân trang)',
    description:
      'Toàn bộ việc lọc chạy phía máy chủ. Ví dụ màn "Nhận phòng hôm nay" của lễ tân: ' +
      '?status=PENDING,CONFIRMED&checkInFrom=2026-09-04&checkInTo=2026-09-04. ' +
      'Response luôn có dạng { data: [...], meta: { total, page, limit, totalPages } }; ' +
      'không truyền page/limit thì trả về toàn bộ kết quả trong data.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    isArray: true,
    enum: BookingStatus,
    description: 'Một hoặc nhiều trạng thái: ?status=PENDING,CONFIRMED hoặc lặp lại tham số',
  })
  @ApiQuery({ name: 'customerId', type: String, required: false })
  @ApiQuery({ name: 'roomId', type: String, required: false })
  @ApiQuery({ name: 'checkInFrom', type: String, required: false, example: '2026-09-04' })
  @ApiQuery({ name: 'checkInTo', type: String, required: false, example: '2026-09-04' })
  @ApiQuery({ name: 'checkOutFrom', type: String, required: false, example: '2026-09-06' })
  @ApiQuery({ name: 'checkOutTo', type: String, required: false, example: '2026-09-06' })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Tìm theo tên khách / SĐT / email / mã đơn / số phòng',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách đặt phòng thành công',
    exampleData: {
      data: [SAMPLE_BOOKING],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    },
  })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    // Nới forbidNonWhitelisted cho riêng route này: query param lạ (ví dụ tham số
    // phá cache của client) bị loại bỏ im lặng thay vì trả về lỗi 400.
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
    query: QueryBookingsDto,
  ) {
    // Khách hàng luôn bị khóa về đơn của chính mình, bất kể customerId gửi lên.
    return this.bookingsService.findAll(
      {
        ...query,
        ...(userRole === Role.CUSTOMER ? { customerId: userId } : {}),
      },
      userRole,
    );
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
  @Patch(':id/confirm')
  @ApiOperation({
    summary: 'Lễ tân/Admin xác nhận đơn khách tự đặt (PENDING -> CONFIRMED)',
    description:
      'Đường đi chính của màn "Chờ xác nhận". Body không bắt buộc: ' +
      'assignedRoomId để xếp khách sang phòng khác (có kiểm tra trùng lịch), ' +
      'note để ghi chú xác nhận, depositAmount để ghi nhận tiền cọc đã thu. ' +
      'Phòng được xếp chuyển sang RESERVED, phòng cũ (nếu đổi) tự động trả về đúng trạng thái.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xác nhận đơn đặt phòng thành công',
    exampleData: {
      message: 'Xác nhận đơn đặt phòng thành công',
      depositAmount: 500000,
      booking: {
        ...SAMPLE_BOOKING,
        status: 'CONFIRMED',
        depositAmount: 500000,
        confirmedAt: '2026-09-04T03:12:00.000Z',
        confirmedBy: { id: 'user-le-tan', fullName: 'Lê Thu Hà (Lễ Tân)', role: 'RECEPTIONIST' },
        confirmationNote: 'Khách đã chuyển khoản cọc, xếp phòng tầng cao theo yêu cầu',
      },
    },
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Phòng 203 đã có đơn BK-2026-0830 trùng lịch trong khoảng thời gian này',
    error: 'Conflict',
    path: '/api/v1/bookings/:id/confirm',
  })
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
    @CurrentUser('id') receptionistId: string,
  ) {
    return this.bookingsService.confirm(id, dto, receptionistId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/confirm')
  @ApiOperation({ summary: 'Lễ tân/Admin xác nhận đơn đặt phòng (POST alias)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xác nhận đơn đặt phòng thành công',
    exampleData: {
      message: 'Xác nhận đơn đặt phòng thành công',
      depositAmount: 500000,
      booking: { ...SAMPLE_BOOKING, status: 'CONFIRMED', depositAmount: 500000 },
    },
  })
  confirmPost(
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
    @CurrentUser('id') receptionistId: string,
  ) {
    return this.bookingsService.confirm(id, dto, receptionistId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Lễ tân/Admin từ chối đơn đặt phòng mà khách đặt trước' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Từ chối đơn đặt phòng thành công',
    exampleData: {
      message: 'Từ chối đơn đặt phòng thành công',
      booking: CANCELLED_BOOKING_SAMPLE,
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
      booking: CANCELLED_BOOKING_SAMPLE,
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

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get(':id/checkout-preview')
  @ApiOperation({
    summary: 'Bảng quyết toán trước khi trả phòng — thu ngân xem phải thu bao nhiêu',
    description:
      'Chỉ đọc, KHÔNG đổi trạng thái đơn hay phòng. Trả về tiền phòng, bảng kê dịch vụ, ' +
      'thuế, tiền cọc, số đã thu và `amountDue` — chính là số tiền còn phải thu của khách. ' +
      'Gọi endpoint này khi thu ngân bấm "Check-out", rồi truyền `amountCollected` vào ' +
      'POST /bookings/:id/check-out theo đúng số tiền thực nhận. ' +
      '`pendingPaymentRequests` là các yêu cầu khách đã gửi qua app nhưng chưa đối chiếu — ' +
      'nên xử lý hết trước khi thu tiền mặt để tránh thu trùng.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy bảng quyết toán thành công',
    exampleData: {
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      bookingCode: 'BK-2026-0829',
      status: 'CHECKED_IN',
      roomNumber: '103',
      customerName: 'Nguyễn Văn A',
      customerPhone: '0912345678',
      invoiceId: 'inv-1234',
      invoiceCode: 'INV-2025-0289',
      roomAmount: 5000000,
      servicesAmount: 300000,
      discount: 0,
      taxRate: 0.1,
      tax: 530000,
      finalAmount: 5830000,
      depositAmount: 1000000,
      alreadyPaidAmount: 3268000,
      amountDue: 2562000,
      serviceItems: [
        { id: 'svc-1', name: 'Minibar trọn gói', quantity: 1, unitPrice: 300000, amount: 300000 },
      ],
      pendingPaymentRequests: [],
      pendingPaymentAmount: 0,
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Chỉ xem được bảng quyết toán của đơn đang lưu trú (CHECKED_IN) hoặc đã trả phòng (CHECKED_OUT)',
    error: 'Bad Request',
    path: '/api/v1/bookings/:id/checkout-preview',
  })
  checkoutPreview(@Param('id') id: string) {
    return this.bookingsService.checkoutPreview(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/check-out')
  @ApiOperation({
    summary: 'Check-out trả phòng, tính tiền dịch vụ và xuất hóa đơn',
    description:
      'Chốt hóa đơn theo đúng bảng quyết toán của GET /bookings/:id/checkout-preview. ' +
      'Truyền `amountCollected` bằng số tiền thu ngân THỰC NHẬN tại quầy — bỏ trống nghĩa là ' +
      'không thu thêm đồng nào. Tiền cọc và các lần khách đã trả trước vẫn được giữ nguyên, ' +
      'không bị ghi đè. Nếu sau check-out vẫn còn thiếu, hóa đơn ở trạng thái PARTIAL/UNPAID ' +
      'và tự động hiện trong mục "Hóa đơn của tôi" của khách để khách thanh toán nốt qua ' +
      'POST /invoices/:id/payment-requests.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Check-out và xuất hóa đơn thành công',
    exampleData: {
      message:
        'Check-out thành công. Hóa đơn còn thiếu 2.562.000đ đã được gửi về mục "Hóa đơn của tôi" để khách thanh toán nốt.',
      invoiceId: 'inv-1234',
      amountCollected: 0,
      remainingAmount: 2562000,
      settlement: {
        roomAmount: 5000000,
        servicesAmount: 300000,
        discount: 0,
        taxRate: 0.1,
        tax: 530000,
        finalAmount: 5830000,
        depositAmount: 1000000,
        alreadyPaidAmount: 3268000,
        amountDue: 2562000,
      },
      booking: { ...SAMPLE_BOOKING, status: 'CHECKED_OUT', actualCheckOut: '2026-09-08T11:45:00.000Z' },
      invoice: {
        id: 'inv-1234',
        invoiceCode: 'INV-2026-0045',
        roomAmount: 5000000,
        servicesAmount: 300000,
        finalAmount: 5830000,
        paidAmount: 3268000,
        paymentStatus: 'PARTIAL',
      },
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Số tiền thu vượt quá số còn phải thu',
    error: 'Bad Request',
    path: '/api/v1/bookings/:id/check-out',
  })
  checkOut(
    @Param('id') id: string,
    @Body() checkOutDto: CheckOutDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.bookingsService.checkOut(id, checkOutDto, cashierId);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Hủy đơn đặt phòng kèm lý do và giải phóng trạng thái phòng',
    description:
      'Nhận body { cancellationReason }. Lý do được lưu lại và trả về trong mọi response của đơn ' +
      'kèm cancelledAt và cancelledBy, để khách thấy được vì sao đơn bị hủy. ' +
      'KHÁCH HÀNG chỉ được tự hủy khi đơn còn PENDING; lễ tân đã xác nhận (CONFIRMED) thì khách ' +
      'phải liên hệ lễ tân. ADMIN/RECEPTIONIST hủy hộ được cả đơn CONFIRMED, nhưng đơn đã ' +
      'CHECKED_IN / CHECKED_OUT thì không vai trò nào hủy được.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Hủy đơn đặt phòng thành công',
    exampleData: CANCELLED_BOOKING_SAMPLE,
  })
  @ApiErrorResponse({
    status: 403,
    message:
      'Đơn đặt phòng đã được lễ tân xác nhận nên không thể tự hủy. Vui lòng liên hệ lễ tân để được hỗ trợ.',
    error: 'Forbidden',
    path: '/api/v1/bookings/:id/cancel',
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Khách đang ở phòng, không thể hủy đơn đặt',
    error: 'Bad Request',
    path: '/api/v1/bookings/:id/cancel',
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.cancel(id, dto, userId, userRole);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Hủy đơn đặt phòng kèm lý do (PATCH alias cho client Flutter)',
    description:
      'Cùng quy tắc với POST :id/cancel — khách chỉ tự hủy được đơn PENDING, đơn đã xác nhận ' +
      'hoặc đã nhận phòng thì không.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Hủy đơn đặt phòng thành công',
    exampleData: CANCELLED_BOOKING_SAMPLE,
  })
  @ApiErrorResponse({
    status: 403,
    message:
      'Đơn đặt phòng đã được lễ tân xác nhận nên không thể tự hủy. Vui lòng liên hệ lễ tân để được hỗ trợ.',
    error: 'Forbidden',
    path: '/api/v1/bookings/:id/cancel',
  })
  cancelPatch(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.cancel(id, dto, userId, userRole);
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

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/change-room')
  @ApiOperation({ summary: 'Đổi phòng cho khách đang lưu trú tại khách sạn (S2 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đổi phòng thành công',
    exampleData: {
      message: 'Đổi phòng thành công',
      booking: SAMPLE_BOOKING,
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Chỉ có thể đổi phòng cho đơn đang lưu trú CHECKED_IN hoặc phòng mới không khả dụng',
    error: 'Bad Request',
    path: '/api/v1/bookings/:id/change-room',
  })
  changeRoom(
    @Param('id') id: string,
    @Body() dto: ChangeRoomDto,
  ) {
    return this.bookingsService.changeRoom(id, dto);
  }

  @Roles(Role.CUSTOMER)
  @Post(':id/service-requests')
  @ApiOperation({ summary: 'Khách hàng gọi dịch vụ tại phòng (C1 - P1)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Yêu cầu dịch vụ phòng thành công',
    exampleData: {
      id: 'srv-req-123',
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      serviceName: 'Giặt là cao cấp',
      quantity: 2,
      unitPrice: 50000,
      totalPrice: 100000,
      status: 'REQUESTED',
      note: 'Giao trước 10h',
    },
  })
  requestService(
    @Param('id') id: string,
    @Body() dto: RequestServiceDto,
    @CurrentUser('id') customerId: string,
  ) {
    return this.bookingsService.requestServiceOrder(id, dto, customerId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/services/:orderId')
  @ApiOperation({ summary: 'Lễ tân duyệt hoặc từ chối yêu cầu dịch vụ của khách (C1 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật trạng thái yêu cầu dịch vụ thành công',
    exampleData: {
      id: 'srv-req-123',
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      status: 'CONFIRMED',
      note: 'Đã giao đồ lên phòng',
    },
  })
  updateServiceStatus(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateServiceOrderStatusDto,
  ) {
    return this.bookingsService.updateServiceOrderStatus(id, orderId, dto);
  }
}
