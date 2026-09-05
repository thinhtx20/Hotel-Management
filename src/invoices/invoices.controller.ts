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
import { InvoicesService } from './invoices.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RefundDto } from './dto/refund.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { PaymentStatus, Role } from '@prisma/client';

const SAMPLE_INVOICE = {
  id: 'a9b8c7d6-e5f4-3210-fedc-ba9876543210',
  invoiceCode: 'INV-2026-0089',
  bookingId: 'b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1',
  roomAmount: 3600000,
  servicesAmount: 200000,
  discount: 0,
  tax: 0,
  finalAmount: 3800000,
  paidAmount: 3800000,
  paymentMethod: 'CREDIT_CARD',
  paymentStatus: 'PAID',
  paidAt: '2026-09-03T07:00:00.000Z',
  issuedById: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  roomNumber: '101',
  customerName: 'Nguyễn Văn Khách Hàng',
  customerPhone: '0912345678',
  items: [
    { name: 'Tiền thuê phòng P.101', quantity: 1, unitPrice: 3600000, amount: 3600000 },
    { name: 'Minibar trọn gói', quantity: 1, unitPrice: 200000, amount: 200000 },
  ],
  payments: [
    { amount: 3800000, paymentMethod: 'CREDIT_CARD', paidAt: '2026-09-03T07:00:00.000Z', cashierName: 'Lê Thu Ngân' },
  ],
  booking: {
    bookingCode: 'BK-2026-0829',
    customer: {
      fullName: 'Nguyễn Văn Khách Hàng',
      phone: '0912345678',
    },
    room: {
      roomNumber: '101',
    },
  },
};

@ApiTags('Invoices (Hóa đơn & Thu ngân)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('summary')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Tổng quan doanh thu hôm nay hoặc sổ quỹ chốt ca (Lễ tân – Thu ngân)' })
  @ApiQuery({ name: 'date', required: false, description: 'today hoặc ngày theo định dạng YYYY-MM-DD' })
  @ApiQuery({ name: 'staffId', required: false, description: '"me" để xem chốt ca của chính mình, hoặc userId của nhân viên cụ thể' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy tóm tắt doanh thu thành công',
    exampleData: {
      date: '2026-09-03',
      todayRevenue: 128500000,
      totalInvoices: 18,
      paidInvoices: 14,
      unpaidInvoices: 3,
      partialInvoices: 1,
    },
  })
  getSummary(
    @Query('date') date?: string,
    @Query('staffId') staffId?: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.invoicesService.getSummary(date, staffId, currentUserId);
  }

  @Get('my')
  @ApiOperation({
    summary: 'Hóa đơn của chính tôi (màn "Hóa đơn của tôi" bên app khách hàng)',
    description:
      'Chỉ trả về hóa đơn thuộc các đơn đặt phòng của tài khoản đang đăng nhập. ' +
      'Nhân viên gọi endpoint này cũng chỉ thấy hóa đơn gắn với tài khoản của chính họ — ' +
      'muốn xem toàn bộ hóa đơn khách sạn thì dùng GET /invoices.',
  })
  @ApiQuery({ name: 'status', enum: PaymentStatus, required: false })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách hóa đơn của tài khoản hiện tại thành công',
    exampleData: [SAMPLE_INVOICE],
  })
  findMine(
    @CurrentUser('id') userId: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.invoicesService.findMyInvoices(userId, status);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Tạo hóa đơn thủ công cho đơn đặt phòng' })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tạo hóa đơn thành công',
    exampleData: SAMPLE_INVOICE,
  })
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.invoicesService.create(dto, cashierId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Lấy danh sách hóa đơn theo trạng thái thanh toán' })
  @ApiQuery({ name: 'status', enum: PaymentStatus, required: false })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách hóa đơn thành công',
    exampleData: [SAMPLE_INVOICE],
  })
  findAll(@Query('status') status?: PaymentStatus) {
    return this.invoicesService.findAll(status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CUSTOMER)
  @ApiOperation({
    summary: 'Xem chi tiết hóa đơn, tiền phòng và bảng kê dịch vụ phụ trợ',
    description:
      'Nhân viên xem được mọi hóa đơn. Khách hàng chỉ mở được hóa đơn thuộc đơn đặt phòng ' +
      'của chính mình, sai chủ sở hữu sẽ nhận 403.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xem chi tiết hóa đơn thành công',
    exampleData: SAMPLE_INVOICE,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'Không tìm thấy hóa đơn với ID tương ứng',
    error: 'Not Found',
    path: '/api/v1/invoices/:id',
  })
  @ApiErrorResponse({
    status: 403,
    message: 'Bạn chỉ có thể xem hóa đơn thuộc đơn đặt phòng của chính mình',
    error: 'Forbidden',
    path: '/api/v1/invoices/:id',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.invoicesService.findOne(id, userId, userRole);
  }

  @Post(':id/pay')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Ghi nhận thanh toán hóa đơn (Lễ tân – Thu ngân)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Ghi nhận thanh toán hóa đơn thành công',
    exampleData: SAMPLE_INVOICE,
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Hóa đơn này đã được thanh toán đủ toàn bộ',
    error: 'Bad Request',
    path: '/api/v1/invoices/:id/pay',
  })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.invoicesService.recordPayment(id, dto, cashierId);
  }

  @Post(':id/refund')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Hoàn tiền hóa đơn (Lễ tân – Thu ngân)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Hoàn tiền hóa đơn thành công',
    exampleData: SAMPLE_INVOICE,
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Số tiền hoàn vượt quá số tiền đã thu hoặc hóa đơn chưa thanh toán',
    error: 'Bad Request',
    path: '/api/v1/invoices/:id/refund',
  })
  refund(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @CurrentUser('id') staffId: string,
  ) {
    return this.invoicesService.refund(id, dto, staffId);
  }
}
