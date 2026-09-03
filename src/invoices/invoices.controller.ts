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
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
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
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @ApiOperation({ summary: 'Xem chi tiết hóa đơn, tiền phòng và bảng kê dịch vụ phụ trợ' })
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
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post(':id/pay')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @ApiOperation({ summary: 'Ghi nhận thanh toán hóa đơn (Thu ngân / Kế toán)' })
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
}
