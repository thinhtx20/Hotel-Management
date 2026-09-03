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
import { PaymentStatus, Role } from '@prisma/client';

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
  findAll(@Query('status') status?: PaymentStatus) {
    return this.invoicesService.findAll(status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @ApiOperation({ summary: 'Xem chi tiết hóa đơn, tiền phòng và bảng kê dịch vụ phụ trợ' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post(':id/pay')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @ApiOperation({ summary: 'Ghi nhận thanh toán hóa đơn (Thu ngân / Kế toán)' })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser('id') cashierId: string,
  ) {
    return this.invoicesService.recordPayment(id, dto, cashierId);
  }
}
