import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success-response.decorator';
import { DEFAULT_REVENUE_RANGE, REVENUE_RANGES } from '../common/utils/revenue.util';
import { Role } from '@prisma/client';

@ApiTags('Analytics & Dashboard (Báo cáo & Thống kê)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @Get('dashboard')
  @ApiOperation({
    summary: 'Tổng quan chỉ số phòng, khách hôm nay và tỷ lệ lấp đầy',
    description:
      'Dùng chung cho cả ba vai trò nhân viên. Thu ngân cần khối doanh thu và ' +
      'số hóa đơn chưa thu trong cùng một lần gọi nên cũng được cấp quyền ở đây.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy dữ liệu tổng quan Dashboard thành công',
    exampleData: {
      totalRooms: 20,
      availableRooms: 6,
      occupiedRooms: 10,
      reservedRooms: 2,
      cleaningRooms: 1,
      maintenanceRooms: 1,
      occupancyRate: 50.0,
      todayCheckIns: 4,
      todayCheckOuts: 2,
      activeBookings: 12,
      todayRevenue: 15400000,
      yesterdayRevenue: 13700000,
      revenueChangePercent: 12.4,
      pendingBookings: 4,
      unpaidInvoices: 3,
      rooms: {
        total: 20,
        available: 6,
        occupied: 10,
        reserved: 2,
        cleaning: 1,
        maintenance: 1,
        occupancyRate: '50.0%',
      },
      todayActivity: {
        expectedCheckIns: 4,
        expectedCheckOuts: 2,
        activeBookings: 12,
      },
      totalRevenue: 145000000,
    },
  })
  getDashboard() {
    return this.analyticsService.getDashboardOverview();
  }

  @Roles(Role.ADMIN)
  @Get('revenue')
  @ApiOperation({ summary: 'Báo cáo doanh thu theo năm và biểu đồ 12 tháng (Chỉ Admin)' })
  @ApiQuery({ name: 'year', type: Number, required: false, example: 2026 })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy báo cáo doanh thu theo năm thành công',
    exampleData: {
      year: 2026,
      summary: {
        totalYearRevenue: 1250000000,
        totalRoomRevenue: 1100000000,
        totalServicesRevenue: 150000000,
        totalInvoices: 145,
      },
      monthly: [
        { month: 1, totalRevenue: 95000000, roomRevenue: 85000000, serviceRevenue: 10000000, invoiceCount: 12 },
        { month: 2, totalRevenue: 110000000, roomRevenue: 98000000, serviceRevenue: 12000000, invoiceCount: 15 },
      ],
    },
  })
  getRevenue(@Query('year') year?: number) {
    return this.analyticsService.getRevenueAnalytics(year ? Number(year) : undefined);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @Get('revenue/daily')
  @ApiOperation({
    summary:
      'Doanh thu theo ngày, chia sẵn 4 khoảng 1 / 7 / 14 / 30 ngày (mặc định 7)',
    description:
      'Trả về cùng lúc cả 4 khoảng chuẩn trong `ranges` để FE bấm chip lọc là đổi ngay, ' +
      'không phải gọi lại API. `series` / `total` / `average` / `peak` ở cấp ngoài ứng với ' +
      'khoảng đang chọn qua `?range=`. Doanh thu là **tiền thực thu** (`paidAmount`) ghi nhận ' +
      'theo ngày thanh toán, tính cả hóa đơn thu một phần (PARTIAL).',
  })
  @ApiQuery({ name: 'range', type: Number, required: false, enum: REVENUE_RANGES, example: 7 })
  @ApiQuery({ name: 'days', type: Number, required: false, example: 7, description: 'Alias cũ của range' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy báo cáo doanh thu theo ngày thành công',
    exampleData: {
      range: 7,
      days: 7,
      availableRanges: [1, 7, 14, 30],
      from: '2026-08-28',
      to: '2026-09-03',
      series: [
        { date: '2026-08-28', label: 'T6', dateLabel: '28/08', revenue: 96200000, amount: 96200000, invoiceCount: 4 },
        { date: '2026-08-29', label: 'T7', dateLabel: '29/08', revenue: 112400000, amount: 112400000, invoiceCount: 6 },
        { date: '2026-08-30', label: 'CN', dateLabel: '30/08', revenue: 125000000, amount: 125000000, invoiceCount: 7 },
        { date: '2026-08-31', label: 'T2', dateLabel: '31/08', revenue: 84000000, amount: 84000000, invoiceCount: 3 },
        { date: '2026-09-01', label: 'T3', dateLabel: '01/09', revenue: 91500000, amount: 91500000, invoiceCount: 4 },
        { date: '2026-09-02', label: 'T4', dateLabel: '02/09', revenue: 141900000, amount: 141900000, invoiceCount: 8 },
        { date: '2026-09-03', label: 'T5', dateLabel: '03/09', revenue: 105000000, amount: 105000000, invoiceCount: 5 },
      ],
      total: 756000000,
      average: 108000000,
      peak: { date: '2026-09-02', revenue: 141900000 },
      previousTotal: 673000000,
      changePercent: 12.3,
      invoiceCount: 37,
      ranges: {
        '1': { range: 1, from: '2026-09-03', to: '2026-09-03', total: 105000000, average: 105000000, previousTotal: 141900000, changePercent: -26.0, invoiceCount: 5, peak: { date: '2026-09-03', revenue: 105000000 }, series: ['...'] },
        '7': { range: 7, from: '2026-08-28', to: '2026-09-03', total: 756000000, average: 108000000, previousTotal: 673000000, changePercent: 12.3, invoiceCount: 37, peak: { date: '2026-09-02', revenue: 141900000 }, series: ['...'] },
        '14': { range: 14, from: '2026-08-21', to: '2026-09-03', total: 1429000000, average: 102071429, previousTotal: 1310000000, changePercent: 9.1, invoiceCount: 71, peak: { date: '2026-09-02', revenue: 141900000 }, series: ['...'] },
        '30': { range: 30, from: '2026-08-05', to: '2026-09-03', total: 3050000000, average: 101666667, previousTotal: 2890000000, changePercent: 5.5, invoiceCount: 152, peak: { date: '2026-09-02', revenue: 141900000 }, series: ['...'] },
      },
    },
  })
  getDailyRevenue(@Query('range') range?: number, @Query('days') days?: number) {
    const selected = range ?? days;
    return this.analyticsService.getDailyRevenue(
      selected !== undefined ? Number(selected) : DEFAULT_REVENUE_RANGE,
    );
  }

  @Get('occupancy-by-type')
  @ApiOperation({ summary: 'Thống kê tỷ lệ lấp đầy theo từng loại phòng' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy thống kê tỷ lệ lấp đầy theo hạng phòng thành công',
    exampleData: [
      {
        roomTypeId: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
        roomTypeName: 'Phòng Deluxe Hướng Biển',
        code: 'DELUXE_OCEAN',
        basePrice: 1200000,
        totalRooms: 8,
        occupiedRooms: 6,
        availableRooms: 1,
        reservedRooms: 1,
        occupancyRate: '75.0%',
      },
    ],
  })
  getOccupancyByType() {
    return this.analyticsService.getOccupancyByRoomType();
  }
}
