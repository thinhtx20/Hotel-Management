import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { QueryShiftsDto } from './dto/query-shifts.dto';
import { ApiSuccessResponse } from '../common/decorators/api-success-response.decorator';

const SAMPLE_SHIFT = {
  id: 'shift-uuid-001',
  shiftCode: 'SFT-20260907-001',
  staffId: 'staff-uuid-001',
  shiftType: 'MORNING',
  deskName: 'Quầy Lễ Tân 1',
  status: 'OPEN',
  startTime: '2026-09-07T07:00:00.000Z',
  endTime: null,
  initialCash: 2000000,
  actualCash: null,
  expectedCash: null,
  cashDifference: null,
  creditCardAmount: 0,
  bankTransferAmount: 0,
  totalRevenue: 0,
  stats: {
    initialCash: 2000000,
    cashCollected: 1500000,
    cashRefunded: 0,
    netCashChange: 1500000,
    expectedCash: 3500000,
    creditCardAmount: 800000,
    bankTransferAmount: 1200000,
    totalRevenue: 3500000,
    paymentCount: 4,
    refundCount: 0,
  },
};

@ApiTags('Shifts (Quản lý Ca trực & Bàn giao tiền két)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Bắt đầu ca trực quầy (Lễ tân – Thu ngân)',
    description:
      'Lễ tân mở ca khi bắt đầu làm việc tại quầy, khai báo số tiền mặt trong két nhận bàn giao đầu ca. ' +
      'Mỗi nhân viên chỉ được mở 1 ca tại một thời điểm.',
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Mở ca làm việc thành công',
    exampleData: SAMPLE_SHIFT,
  })
  openShift(
    @CurrentUser('id') staffId: string,
    @Body() dto: OpenShiftDto,
  ) {
    return this.shiftsService.openShift(staffId, dto);
  }

  @Get('current')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Thông tin ca trực hiện tại của tôi (Kèm số liệu tiền két realtime)',
    description:
      'Trả về ca trực OPEN của nhân viên đang đăng nhập cùng số liệu đối soát tức thời: ' +
      'tiền đầu ca, tiền mặt đã thu/hoàn, số tiền lý thuyết hiện tại phải có trong két.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Thông tin ca trực hiện hành',
    exampleData: SAMPLE_SHIFT,
  })
  getCurrentShift(@CurrentUser('id') staffId: string) {
    return this.shiftsService.getCurrentShift(staffId);
  }

  @Get('active')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Danh sách lễ tân đang làm việc tại quầy (Cho Admin & Ban quản lý)',
    description:
      'Hiển thị toàn bộ các ca trực đang mở (OPEN) tại các quầy: ' +
      'lễ tân nào đang trực, quầy số mấy, vào ca từ lúc mấy giờ và doanh thu tạm tính.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Danh sách nhân sự đang trực quầy',
    exampleData: [SAMPLE_SHIFT],
  })
  getActiveShifts() {
    return this.shiftsService.getActiveShifts();
  }

  @Post('close')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Chốt ca trực & bàn giao quỹ tiền két',
    description:
      'Lễ tân kiểm đếm tiền mặt thực tế có trong két và chốt ca. ' +
      'Hệ thống tự tính chênh lệch so với sổ sách, yêu cầu giải trình nếu có sai lệch và chốt báo cáo doanh thu.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Chốt ca trực thành công',
    exampleData: {
      ...SAMPLE_SHIFT,
      status: 'CLOSED',
      endTime: '2026-09-07T15:00:00.000Z',
      actualCash: 3500000,
      expectedCash: 3500000,
      cashDifference: 0,
    },
  })
  closeShift(
    @CurrentUser('id') staffId: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.closeShift(staffId, dto);
  }

  @Post(':id/close')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Quản trị viên chốt ca hộ cho nhân viên',
    description: 'Dành cho Admin đóng một ca trực cụ thể trong trường hợp nhân viên quên chốt ca khi về.',
  })
  @ApiParam({ name: 'id', description: 'ID của ca trực cần chốt' })
  closeShiftById(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.closeShift(adminId, dto, id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Lịch sử ca trực & sổ giao ca',
    description: 'Tra cứu danh sách ca trực theo nhân viên, khoảng thời gian hoặc trạng thái (phân trang).',
  })
  findAll(@Query() query: QueryShiftsDto) {
    return this.shiftsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Chi tiết ca trực & bảng kê giao dịch thanh toán trong ca',
  })
  @ApiParam({ name: 'id', description: 'ID ca trực' })
  findOne(@Param('id') id: string) {
    return this.shiftsService.findOne(id);
  }
}
