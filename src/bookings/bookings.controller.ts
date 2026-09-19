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
  specialRequests: 'Nháº­n phÃ²ng táº§ng cao, yÃªn tÄ©nh',
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
      name: 'PhÃ²ng Deluxe HÆ°á»›ng Biá»ƒn',
      basePrice: 1200000,
    },
  },
  customer: {
    fullName: 'Nguyá»…n VÄƒn KhÃ¡ch HÃ ng',
    phone: '0912345678',
    email: 'customer@hotel.com',
  },
};

const CANCELLED_BOOKING_SAMPLE = {
  ...SAMPLE_BOOKING,
  status: 'CANCELLED',
  cancellationReason: 'KhÃ¡ch bÃ¡o báº­n cÃ´ng tÃ¡c Ä‘á»™t xuáº¥t, xin há»§y phÃ²ng',
  cancelledAt: '2026-09-04T03:20:00.000Z',
  cancelledBy: {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    fullName: 'Nguyá»…n VÄƒn KhÃ¡ch HÃ ng',
    role: 'CUSTOMER',
  },
};

@ApiTags('Bookings (Äáº·t phÃ²ng & LÆ°u trÃº)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Äáº·t phÃ²ng má»›i (Tá»± Ä‘á»™ng tÃ­nh tiá»n & phÃ²ng trÃ¡nh trÃ¹ng lá»‹ch)',
    description:
      'KhÃ¡ch hÃ ng (CUSTOMER) tá»± Ä‘áº·t luÃ´n táº¡o Ä‘Æ¡n á»Ÿ tráº¡ng thÃ¡i PENDING Ä‘á»ƒ lá»… tÃ¢n xÃ¡c nháº­n qua ' +
      'PATCH /bookings/{id}/confirm. Chá»‰ ADMIN / RECEPTIONIST má»›i Ä‘Æ°á»£c truyá»n status Ä‘á»ƒ táº¡o tháº³ng Ä‘Æ¡n CONFIRMED.',
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Äáº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: SAMPLE_BOOKING,
  })
  @ApiErrorResponse({
    status: 409,
    message: 'PhÃ²ng nÃ y Ä‘Ã£ cÃ³ khÃ¡ch Ä‘áº·t hoáº·c Ä‘ang cÃ³ ngÆ°á»i lÆ°u trÃº trong khoáº£ng thá»i gian Ä‘Ã£ chá»n',
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
    summary: 'Xem danh sÃ¡ch Ä‘áº·t phÃ²ng (Lá»c theo tráº¡ng thÃ¡i, khoáº£ng ngÃ y, tÃ¬m kiáº¿m, phÃ¢n trang)',
    description:
      'ToÃ n bá»™ viá»‡c lá»c cháº¡y phÃ­a mÃ¡y chá»§. VÃ­ dá»¥ mÃ n "Nháº­n phÃ²ng hÃ´m nay" cá»§a lá»… tÃ¢n: ' +
      '?status=PENDING,CONFIRMED&checkInFrom=2026-09-04&checkInTo=2026-09-04. ' +
      'Response luÃ´n cÃ³ dáº¡ng { data: [...], meta: { total, page, limit, totalPages } }; ' +
      'khÃ´ng truyá»n page/limit thÃ¬ tráº£ vá» toÃ n bá»™ káº¿t quáº£ trong data.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    isArray: true,
    enum: BookingStatus,
    description: 'Má»™t hoáº·c nhiá»u tráº¡ng thÃ¡i: ?status=PENDING,CONFIRMED hoáº·c láº·p láº¡i tham sá»‘',
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
    description: 'TÃ¬m theo tÃªn khÃ¡ch / SÄT / email / mÃ£ Ä‘Æ¡n / sá»‘ phÃ²ng',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiSuccessResponse({
    status: 200,
    description: 'Láº¥y danh sÃ¡ch Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      data: [SAMPLE_BOOKING],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    },
  })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    // Ná»›i forbidNonWhitelisted cho riÃªng route nÃ y: query param láº¡ (vÃ­ dá»¥ tham sá»‘
    // phÃ¡ cache cá»§a client) bá»‹ loáº¡i bá» im láº·ng thay vÃ¬ tráº£ vá» lá»—i 400.
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
    query: QueryBookingsDto,
  ) {
    // KhÃ¡ch hÃ ng luÃ´n bá»‹ khÃ³a vá» Ä‘Æ¡n cá»§a chÃ­nh mÃ¬nh, báº¥t ká»ƒ customerId gá»­i lÃªn.
    return this.bookingsService.findAll(
      {
        ...query,
        ...(userRole === Role.CUSTOMER ? { customerId: userId } : {}),
      },
      userRole,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiáº¿t Ä‘Æ¡n Ä‘áº·t phÃ²ng' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Láº¥y thÃ´ng tin chi tiáº¿t Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: SAMPLE_BOOKING,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n Ä‘áº·t phÃ²ng vá»›i ID tÆ°Æ¡ng á»©ng',
    error: 'Not Found',
    path: '/api/v1/bookings/:id',
  })
  @ApiErrorResponse({
    status: 403,
    message: 'Báº¡n chá»‰ cÃ³ thá»ƒ xem vÃ  thao tÃ¡c trÃªn Ä‘Æ¡n Ä‘áº·t phÃ²ng cá»§a chÃ­nh mÃ¬nh',
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
    summary: 'Lá»… tÃ¢n/Admin phÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng vÃ  xÃ¡c nháº­n tiá»n cá»c',
    description:
      'Chuyá»ƒn Ä‘Æ¡n tá»« PENDING sang CONFIRMED. Náº¿u cÃ³ tiá»n cá»c (depositAmount), tá»± Ä‘á»™ng táº¡o/cáº­p nháº­t hÃ³a Ä‘Æ¡n cá»c ' +
      'vÃ  chuyá»ƒn tráº¡ng thÃ¡i phÃ²ng sang RESERVED (Cam há»• phÃ¡ch).',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'PhÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng vÃ  xÃ¡c nháº­n tiá»n cá»c thÃ nh cÃ´ng',
    exampleData: {
      message: 'PhÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng vÃ  xÃ¡c nháº­n tiá»n cá»c thÃ nh cÃ´ng',
      depositAmount: 500000,
      booking: { ...SAMPLE_BOOKING, status: 'CONFIRMED', depositAmount: 500000 },
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'ÄÆ¡n Ä‘áº·t phÃ²ng nÃ y Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t trÆ°á»›c Ä‘Ã³ hoáº·c Ä‘Ã£ bá»‹ há»§y',
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
  @ApiOperation({ summary: 'Lá»… tÃ¢n/Admin phÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng (POST alias)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'PhÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng vÃ  xÃ¡c nháº­n tiá»n cá»c thÃ nh cÃ´ng',
    exampleData: {
      message: 'PhÃª duyá»‡t Ä‘Æ¡n Ä‘áº·t phÃ²ng vÃ  xÃ¡c nháº­n tiá»n cá»c thÃ nh cÃ´ng',
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
    summary: 'Lá»… tÃ¢n/Admin xÃ¡c nháº­n Ä‘Æ¡n khÃ¡ch tá»± Ä‘áº·t (PENDING -> CONFIRMED)',
    description:
      'ÄÆ°á»ng Ä‘i chÃ­nh cá»§a mÃ n "Chá» xÃ¡c nháº­n". Body khÃ´ng báº¯t buá»™c: ' +
      'assignedRoomId Ä‘á»ƒ xáº¿p khÃ¡ch sang phÃ²ng khÃ¡c (cÃ³ kiá»ƒm tra trÃ¹ng lá»‹ch), ' +
      'note Ä‘á»ƒ ghi chÃº xÃ¡c nháº­n, depositAmount Ä‘á»ƒ ghi nháº­n tiá»n cá»c Ä‘Ã£ thu. ' +
      'PhÃ²ng Ä‘Æ°á»£c xáº¿p chuyá»ƒn sang RESERVED, phÃ²ng cÅ© (náº¿u Ä‘á»•i) tá»± Ä‘á»™ng tráº£ vá» Ä‘Ãºng tráº¡ng thÃ¡i.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'XÃ¡c nháº­n Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      message: 'XÃ¡c nháº­n Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
      depositAmount: 500000,
      booking: {
        ...SAMPLE_BOOKING,
        status: 'CONFIRMED',
        depositAmount: 500000,
        confirmedAt: '2026-09-04T03:12:00.000Z',
        confirmedBy: { id: 'user-le-tan', fullName: 'LÃª Thu HÃ  (Lá»… TÃ¢n)', role: 'RECEPTIONIST' },
        confirmationNote: 'KhÃ¡ch Ä‘Ã£ chuyá»ƒn khoáº£n cá»c, xáº¿p phÃ²ng táº§ng cao theo yÃªu cáº§u',
      },
    },
  })
  @ApiErrorResponse({
    status: 409,
    message: 'PhÃ²ng 203 Ä‘Ã£ cÃ³ Ä‘Æ¡n BK-2026-0830 trÃ¹ng lá»‹ch trong khoáº£ng thá»i gian nÃ y',
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
  @ApiOperation({ summary: 'Lá»… tÃ¢n/Admin xÃ¡c nháº­n Ä‘Æ¡n Ä‘áº·t phÃ²ng (POST alias)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'XÃ¡c nháº­n Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      message: 'XÃ¡c nháº­n Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
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
  @ApiOperation({ summary: 'Lá»… tÃ¢n/Admin tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng mÃ  khÃ¡ch Ä‘áº·t trÆ°á»›c' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      message: 'Tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
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
  @ApiOperation({ summary: 'Lá»… tÃ¢n/Admin tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng (POST alias)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      message: 'Tá»« chá»‘i Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
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
  @ApiOperation({ summary: 'Check-in khÃ¡ch vÃ o nháº­n phÃ²ng (Chuyá»ƒn phÃ²ng sang OCCUPIED)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Check-in nháº­n phÃ²ng thÃ nh cÃ´ng',
    exampleData: { ...SAMPLE_BOOKING, status: 'CHECKED_IN', actualCheckIn: '2026-09-05T14:10:00.000Z' },
  })
  checkIn(@Param('id') id: string) {
    return this.bookingsService.checkIn(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get(':id/checkout-preview')
  @ApiOperation({
    summary: 'Báº£ng quyáº¿t toÃ¡n trÆ°á»›c khi tráº£ phÃ²ng â€” thu ngÃ¢n xem pháº£i thu bao nhiÃªu',
    description:
      'Chá»‰ Ä‘á»c, KHÃ”NG Ä‘á»•i tráº¡ng thÃ¡i Ä‘Æ¡n hay phÃ²ng. Tráº£ vá» tiá»n phÃ²ng, báº£ng kÃª dá»‹ch vá»¥, ' +
      'thuáº¿, tiá»n cá»c, sá»‘ Ä‘Ã£ thu vÃ  `amountDue` â€” chÃ­nh lÃ  sá»‘ tiá»n cÃ²n pháº£i thu cá»§a khÃ¡ch. ' +
      'Gá»i endpoint nÃ y khi thu ngÃ¢n báº¥m "Check-out", rá»“i truyá»n `amountCollected` vÃ o ' +
      'POST /bookings/:id/check-out theo Ä‘Ãºng sá»‘ tiá»n thá»±c nháº­n. ' +
      '`pendingPaymentRequests` lÃ  cÃ¡c yÃªu cáº§u khÃ¡ch Ä‘Ã£ gá»­i qua app nhÆ°ng chÆ°a Ä‘á»‘i chiáº¿u â€” ' +
      'nÃªn xá»­ lÃ½ háº¿t trÆ°á»›c khi thu tiá»n máº·t Ä‘á»ƒ trÃ¡nh thu trÃ¹ng.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Láº¥y báº£ng quyáº¿t toÃ¡n thÃ nh cÃ´ng',
    exampleData: {
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      bookingCode: 'BK-2026-0829',
      status: 'CHECKED_IN',
      roomNumber: '103',
      customerName: 'Nguyá»…n VÄƒn A',
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
        { id: 'svc-1', name: 'Minibar trá»n gÃ³i', quantity: 1, unitPrice: 300000, amount: 300000 },
      ],
      pendingPaymentRequests: [],
      pendingPaymentAmount: 0,
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Chá»‰ xem Ä‘Æ°á»£c báº£ng quyáº¿t toÃ¡n cá»§a Ä‘Æ¡n Ä‘ang lÆ°u trÃº (CHECKED_IN) hoáº·c Ä‘Ã£ tráº£ phÃ²ng (CHECKED_OUT)',
    error: 'Bad Request',
    path: '/api/v1/bookings/:id/checkout-preview',
  })
  checkoutPreview(@Param('id') id: string) {
    return this.bookingsService.checkoutPreview(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/check-out')
  @ApiOperation({
    summary: 'Check-out tráº£ phÃ²ng, tÃ­nh tiá»n dá»‹ch vá»¥ vÃ  xuáº¥t hÃ³a Ä‘Æ¡n',
    description:
      'Chá»‘t hÃ³a Ä‘Æ¡n theo Ä‘Ãºng báº£ng quyáº¿t toÃ¡n cá»§a GET /bookings/:id/checkout-preview. ' +
      'Truyá»n `amountCollected` báº±ng sá»‘ tiá»n thu ngÃ¢n THá»°C NHáº¬N táº¡i quáº§y â€” bá» trá»‘ng nghÄ©a lÃ  ' +
      'khÃ´ng thu thÃªm Ä‘á»“ng nÃ o. Tiá»n cá»c vÃ  cÃ¡c láº§n khÃ¡ch Ä‘Ã£ tráº£ trÆ°á»›c váº«n Ä‘Æ°á»£c giá»¯ nguyÃªn, ' +
      'khÃ´ng bá»‹ ghi Ä‘Ã¨. Náº¿u sau check-out váº«n cÃ²n thiáº¿u, hÃ³a Ä‘Æ¡n á»Ÿ tráº¡ng thÃ¡i PARTIAL/UNPAID ' +
      'vÃ  tá»± Ä‘á»™ng hiá»‡n trong má»¥c "HÃ³a Ä‘Æ¡n cá»§a tÃ´i" cá»§a khÃ¡ch Ä‘á»ƒ khÃ¡ch thanh toÃ¡n ná»‘t qua ' +
      'POST /invoices/:id/payment-requests.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Check-out vÃ  xuáº¥t hÃ³a Ä‘Æ¡n thÃ nh cÃ´ng',
    exampleData: {
      message:
        'Check-out thÃ nh cÃ´ng. HÃ³a Ä‘Æ¡n cÃ²n thiáº¿u 2.562.000Ä‘ Ä‘Ã£ Ä‘Æ°á»£c gá»­i vá» má»¥c "HÃ³a Ä‘Æ¡n cá»§a tÃ´i" Ä‘á»ƒ khÃ¡ch thanh toÃ¡n ná»‘t.',
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
    message: 'Sá»‘ tiá»n thu vÆ°á»£t quÃ¡ sá»‘ cÃ²n pháº£i thu',
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
    summary: 'Há»§y Ä‘Æ¡n Ä‘áº·t phÃ²ng kÃ¨m lÃ½ do vÃ  giáº£i phÃ³ng tráº¡ng thÃ¡i phÃ²ng',
    description:
      'Nháº­n body { cancellationReason }. LÃ½ do Ä‘Æ°á»£c lÆ°u láº¡i vÃ  tráº£ vá» trong má»i response cá»§a Ä‘Æ¡n ' +
      'kÃ¨m cancelledAt vÃ  cancelledBy, Ä‘á»ƒ khÃ¡ch tháº¥y Ä‘Æ°á»£c vÃ¬ sao Ä‘Æ¡n bá»‹ há»§y. ' +
      'KHÃCH HÃ€NG chá»‰ Ä‘Æ°á»£c tá»± há»§y khi Ä‘Æ¡n cÃ²n PENDING; lá»… tÃ¢n Ä‘Ã£ xÃ¡c nháº­n (CONFIRMED) thÃ¬ khÃ¡ch ' +
      'pháº£i liÃªn há»‡ lá»… tÃ¢n. ADMIN/RECEPTIONIST há»§y há»™ Ä‘Æ°á»£c cáº£ Ä‘Æ¡n CONFIRMED, nhÆ°ng Ä‘Æ¡n Ä‘Ã£ ' +
      'CHECKED_IN / CHECKED_OUT thÃ¬ khÃ´ng vai trÃ² nÃ o há»§y Ä‘Æ°á»£c.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Há»§y Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: CANCELLED_BOOKING_SAMPLE,
  })
  @ApiErrorResponse({
    status: 403,
    message:
      'ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ Ä‘Æ°á»£c lá»… tÃ¢n xÃ¡c nháº­n nÃªn khÃ´ng thá»ƒ tá»± há»§y. Vui lÃ²ng liÃªn há»‡ lá»… tÃ¢n Ä‘á»ƒ Ä‘Æ°á»£c há»— trá»£.',
    error: 'Forbidden',
    path: '/api/v1/bookings/:id/cancel',
  })
  @ApiErrorResponse({
    status: 400,
    message: 'KhÃ¡ch Ä‘ang á»Ÿ phÃ²ng, khÃ´ng thá»ƒ há»§y Ä‘Æ¡n Ä‘áº·t',
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
    summary: 'Há»§y Ä‘Æ¡n Ä‘áº·t phÃ²ng kÃ¨m lÃ½ do (PATCH alias cho client Flutter)',
    description:
      'CÃ¹ng quy táº¯c vá»›i POST :id/cancel â€” khÃ¡ch chá»‰ tá»± há»§y Ä‘Æ°á»£c Ä‘Æ¡n PENDING, Ä‘Æ¡n Ä‘Ã£ xÃ¡c nháº­n ' +
      'hoáº·c Ä‘Ã£ nháº­n phÃ²ng thÃ¬ khÃ´ng.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Há»§y Ä‘Æ¡n Ä‘áº·t phÃ²ng thÃ nh cÃ´ng',
    exampleData: CANCELLED_BOOKING_SAMPLE,
  })
  @ApiErrorResponse({
    status: 403,
    message:
      'ÄÆ¡n Ä‘áº·t phÃ²ng Ä‘Ã£ Ä‘Æ°á»£c lá»… tÃ¢n xÃ¡c nháº­n nÃªn khÃ´ng thá»ƒ tá»± há»§y. Vui lÃ²ng liÃªn há»‡ lá»… tÃ¢n Ä‘á»ƒ Ä‘Æ°á»£c há»— trá»£.',
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
  @ApiOperation({ summary: 'Ghi nháº­n sá»­ dá»¥ng dá»‹ch vá»¥ phá»¥ trá»£ (Minibar, giáº·t lÃ , Äƒn uá»‘ng táº¡i phÃ²ng)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'ThÃªm dá»‹ch vá»¥ phá»¥ trá»£ vÃ o phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      id: 'srv-123',
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      serviceName: 'NÆ°á»›c ngá»t lon Coca & Giáº·t lÃ  Ã¡o sÆ¡ mi',
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
  @ApiOperation({ summary: 'Äá»•i phÃ²ng cho khÃ¡ch Ä‘ang lÆ°u trÃº táº¡i khÃ¡ch sáº¡n (S2 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Äá»•i phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      message: 'Äá»•i phÃ²ng thÃ nh cÃ´ng',
      booking: SAMPLE_BOOKING,
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Chá»‰ cÃ³ thá»ƒ Ä‘á»•i phÃ²ng cho Ä‘Æ¡n Ä‘ang lÆ°u trÃº CHECKED_IN hoáº·c phÃ²ng má»›i khÃ´ng kháº£ dá»¥ng',
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
  @ApiOperation({ summary: 'KhÃ¡ch hÃ ng gá»i dá»‹ch vá»¥ táº¡i phÃ²ng (C1 - P1)' })
  @ApiSuccessResponse({
    status: 201,
    description: 'YÃªu cáº§u dá»‹ch vá»¥ phÃ²ng thÃ nh cÃ´ng',
    exampleData: {
      id: 'srv-req-123',
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      serviceName: 'Giáº·t lÃ  cao cáº¥p',
      quantity: 2,
      unitPrice: 50000,
      totalPrice: 100000,
      status: 'REQUESTED',
      note: 'Giao trÆ°á»›c 10h',
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
  @ApiOperation({ summary: 'Lá»… tÃ¢n duyá»‡t hoáº·c tá»« chá»‘i yÃªu cáº§u dá»‹ch vá»¥ cá»§a khÃ¡ch (C1 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cáº­p nháº­t tráº¡ng thÃ¡i yÃªu cáº§u dá»‹ch vá»¥ thÃ nh cÃ´ng',
    exampleData: {
      id: 'srv-req-123',
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      status: 'CONFIRMED',
      note: 'ÄÃ£ giao Ä‘á»“ lÃªn phÃ²ng',
    },
  })
  updateServiceStatus(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateServiceOrderStatusDto,
  ) {
    return this.bookingsService.updateServiceOrderStatus(id, orderId, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/notify-checkout')
  @ApiOperation({
    summary: 'Gửi thông báo đẩy nhắc nhở trả phòng cho khách hàng (FCM)',
    description: 'Bắn push notification tới thiết bị của khách hàng đang lưu trú tại phòng.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đã gửi thông báo nhắc trả phòng thành công',
    exampleData: {
      success: true,
      message: 'Đã gửi thông báo nhắc trả phòng tới khách hàng',
      bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
      roomNumber: '302',
      hasFcmToken: true,
    },
  })
  notifyCheckoutReminder(@Param('id') id: string) {
    return this.bookingsService.notifyCheckoutReminder(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('notify-today-checkouts')
  @ApiOperation({
    summary: 'Tự động gửi thông báo nhắc trả phòng cho toàn bộ khách có lịch trả phòng hôm nay',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đã xử lý thông báo trả phòng hôm nay',
    exampleData: {
      message: 'Đã xử lý thông báo trả phòng cho 3 phòng hôm nay',
      totalDueToday: 3,
      notificationsSent: 3,
    },
  })
  notifyTodayCheckouts() {
    return this.bookingsService.notifyAllTodayCheckouts();
  }
}
