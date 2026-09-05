import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { ConfirmPaymentDto, RejectPaymentDto } from './dto/review-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryPaymentRequestsDto } from './dto/query-payment-requests.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { PaymentEntryStatus, PaymentStatus, Role } from '@prisma/client';

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
  depositAmount: 1000000,
  remainingAmount: 0,
  pendingAmount: 0,
  hasPendingPaymentRequest: false,
  canRequestPayment: false,
  items: [
    { name: 'Tiền thuê phòng P.101', quantity: 1, unitPrice: 3600000, amount: 3600000 },
    { name: 'Minibar trọn gói', quantity: 1, unitPrice: 200000, amount: 200000 },
  ],
  payments: [
    {
      id: 'pay-0001',
      amount: 1000000,
      type: 'PAYMENT',
      paymentMethod: 'BANK_TRANSFER',
      paidAt: '2026-08-30T03:00:00.000Z',
      reference: null,
      note: 'Tiền cọc giữ chỗ khi duyệt phòng',
      cashierName: 'Lê Thu Ngân',
    },
    {
      id: 'pay-0002',
      amount: 2800000,
      type: 'PAYMENT',
      paymentMethod: 'CREDIT_CARD',
      paidAt: '2026-09-03T07:00:00.000Z',
      reference: 'FT25090312345678',
      note: null,
      cashierName: 'Lê Thu Ngân',
    },
  ],
  pendingPayments: [],
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

const SAMPLE_PAGINATED_INVOICES = {
  data: [SAMPLE_INVOICE],
  meta: {
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
};

const SAMPLE_PAYMENT_REQUEST = {
  id: 'pay-0003',
  invoiceId: 'a9b8c7d6-e5f4-3210-fedc-ba9876543210',
  invoiceCode: 'INV-2025-0289',
  bookingCode: 'BK-2026-0829',
  roomNumber: '103',
  customerName: 'Nguyễn Văn A',
  customerPhone: '0912345678',
  amount: 2564000,
  paymentMethod: 'BANK_TRANSFER',
  status: 'PENDING',
  reference: 'FT25090512345678',
  note: 'Đã chuyển khoản lúc 14:05, nhờ lễ tân kiểm tra giúp',
  requestedAt: '2026-09-05T07:05:00.000Z',
  confirmedAt: null,
  confirmedByName: null,
  rejectedReason: null,
  invoiceFinalAmount: 5832000,
  invoicePaidAmount: 3268000,
  invoiceRemainingAmount: 2564000,
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
      'muốn xem toàn bộ hóa đơn khách sạn thì dùng GET /invoices. Hỗ trợ phân trang qua page và limit.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách hóa đơn của tài khoản hiện tại thành công',
    exampleData: SAMPLE_PAGINATED_INVOICES,
  })
  findMine(
    @CurrentUser('id') userId: string,
    @Query() query: QueryInvoicesDto,
  ) {
    return this.invoicesService.findMyInvoices(userId, query);
  }

  @Get('payment-requests')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Hàng chờ đối chiếu: yêu cầu thanh toán khách gửi từ app',
    description:
      'Khách bấm "Thanh toán" trên app sẽ tạo một yêu cầu PENDING, tiền CHƯA vào hóa đơn. ' +
      'Lễ tân đối chiếu sao kê / nhận tiền mặt rồi xác nhận qua POST /invoices/payments/:paymentId/confirm. ' +
      'Mặc định trả về các yêu cầu đang chờ. Hỗ trợ phân trang qua page và limit.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy hàng chờ đối chiếu thanh toán thành công',
    exampleData: {
      data: [SAMPLE_PAYMENT_REQUEST],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    },
  })
  findPaymentRequests(@Query() query: QueryPaymentRequestsDto) {
    return this.invoicesService.findPaymentRequests(query);
  }

  @Post('payments/:paymentId/confirm')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Xác nhận đã nhận được tiền của một yêu cầu thanh toán (Lễ tân – Thu ngân)',
    description:
      'Chỉ sau bước này số tiền mới được cộng vào paidAmount của hóa đơn. ' +
      'Truyền amount nếu khách chuyển thiếu so với số đã yêu cầu.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xác nhận thanh toán thành công',
    exampleData: {
      message: 'Đã xác nhận thu 2.564.000đ. Hóa đơn đã thanh toán đủ.',
      paymentId: 'pay-0003',
      amount: 2564000,
      invoice: SAMPLE_INVOICE,
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Yêu cầu thanh toán này đã được xác nhận trước đó',
    error: 'Bad Request',
    path: '/api/v1/invoices/payments/:paymentId/confirm',
  })
  confirmPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.invoicesService.confirmPayment(paymentId, dto, cashierId);
  }

  @Post('payments/:paymentId/reject')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Từ chối yêu cầu thanh toán của khách (Lễ tân – Thu ngân)',
    description: 'Dùng khi không tìm thấy giao dịch trên sao kê. Lý do sẽ hiển thị lại cho khách trên app.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Từ chối yêu cầu thanh toán thành công',
    exampleData: {
      message: 'Đã từ chối yêu cầu thanh toán',
      paymentId: 'pay-0003',
      reason: 'Không tìm thấy giao dịch với mã FT25090512345678 trên sao kê',
      invoice: SAMPLE_INVOICE,
    },
  })
  rejectPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.invoicesService.rejectPayment(paymentId, dto, cashierId);
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
  @ApiOperation({
    summary: 'Lấy danh sách hóa đơn theo trạng thái thanh toán & phân trang',
    description:
      'Response luôn có dạng { data: [...], meta: { total, page, limit, totalPages } }; ' +
      'không truyền page/limit thì trả về toàn bộ kết quả trong data.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách hóa đơn thành công',
    exampleData: SAMPLE_PAGINATED_INVOICES,
  })
  findAll(@Query() query: QueryInvoicesDto) {
    return this.invoicesService.findAll(query);
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

  @Post(':id/payment-requests')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CUSTOMER)
  @ApiOperation({
    summary: 'Khách bấm "Thanh toán" trên app — gửi yêu cầu trả số tiền còn lại',
    description:
      'BỎ TRỐNG `amount` để thanh toán TOÀN BỘ số còn lại của hóa đơn (nút "Thanh toán toàn bộ"). ' +
      'Truyền `amount` nếu khách chỉ trả một phần. ' +
      'Endpoint này KHÔNG cộng tiền ngay: nó tạo một yêu cầu ở trạng thái PENDING, ' +
      'lễ tân đối chiếu sao kê rồi xác nhận thì paidAmount mới tăng và "Còn thiếu" mới giảm. ' +
      'Mỗi hóa đơn chỉ được có một yêu cầu chờ tại một thời điểm; khách chỉ gửi được cho hóa đơn của chính mình.',
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Gửi yêu cầu thanh toán thành công',
    exampleData: {
      message:
        'Đã gửi yêu cầu thanh toán toàn bộ số tiền còn lại. Lễ tân sẽ xác nhận sau khi đối chiếu.',
      paymentId: 'pay-0003',
      amount: 2564000,
      remainingAfterConfirm: 0,
      invoice: SAMPLE_INVOICE,
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Hóa đơn này đã được thanh toán đủ, không cần trả thêm',
    error: 'Bad Request',
    path: '/api/v1/invoices/:id/payment-requests',
  })
  @ApiErrorResponse({
    status: 403,
    message: 'Bạn chỉ có thể thanh toán hóa đơn thuộc đơn đặt phòng của chính mình',
    error: 'Forbidden',
    path: '/api/v1/invoices/:id/payment-requests',
  })
  createPaymentRequest(
    @Param('id') id: string,
    @Body() dto: CreatePaymentRequestDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.invoicesService.createPaymentRequest(id, dto, userId, userRole);
  }

  @Delete(':id/payment-requests/:paymentId')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CUSTOMER)
  @ApiOperation({
    summary: 'Hủy yêu cầu thanh toán chưa được lễ tân xác nhận',
    description:
      'Dùng khi khách bấm nhầm hoặc muốn đổi sang trả tại quầy. Chỉ hủy được yêu cầu còn PENDING.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Hủy yêu cầu thanh toán thành công',
    exampleData: { message: 'Đã hủy yêu cầu thanh toán', invoice: SAMPLE_INVOICE },
  })
  cancelPaymentRequest(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.invoicesService.cancelPaymentRequest(id, paymentId, userId, userRole);
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
