import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success-response.decorator';
import { Role } from '@prisma/client';

@ApiTags('Analytics & Dashboard (Báo cáo & Thống kê)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tổng quan chỉ số phòng, khách hôm nay và tỷ lệ lấp đầy' })
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

  @Get('revenue/daily')
  @ApiOperation({ summary: 'Báo cáo doanh thu theo chuỗi ngày gần nhất (mặc định 7 ngày)' })
  @ApiQuery({ name: 'days', type: Number, required: false, example: 7 })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy báo cáo doanh thu theo ngày thành công',
    exampleData: {
      days: 7,
      series: [
        { date: '2026-08-28', label: 'T6', revenue: 96200000, invoiceCount: 4 },
        { date: '2026-08-29', label: 'T7', revenue: 112400000, invoiceCount: 6 },
        { date: '2026-08-30', label: 'CN', revenue: 125000000, invoiceCount: 7 },
        { date: '2026-08-31', label: 'T2', revenue: 84000000, invoiceCount: 3 },
        { date: '2026-09-01', label: 'T3', revenue: 91500000, invoiceCount: 4 },
        { date: '2026-09-02', label: 'T4', revenue: 141900000, invoiceCount: 8 },
        { date: '2026-09-03', label: 'T5', revenue: 105000000, invoiceCount: 5 },
      ],
      total: 756000000,
      average: 108000000,
      peak: { date: '2026-09-02', revenue: 141900000 },
    },
  })
  getDailyRevenue(@Query('days') days?: number) {
    return this.analyticsService.getDailyRevenue(days ? Number(days) : 7);
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
