import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
  @ApiResponse({ status: 200, description: 'Lấy dữ liệu tổng quan Dashboard thành công' })
  getDashboard() {
    return this.analyticsService.getDashboardOverview();
  }

  @Roles(Role.ADMIN)
  @Get('revenue')
  @ApiOperation({ summary: 'Báo cáo doanh thu theo năm và biểu đồ 12 tháng (Chỉ Admin)' })
  @ApiQuery({ name: 'year', type: Number, required: false, example: 2026 })
  @ApiResponse({ status: 200, description: 'Lấy báo cáo doanh thu theo năm thành công' })
  getRevenue(@Query('year') year?: number) {
    return this.analyticsService.getRevenueAnalytics(year ? Number(year) : undefined);
  }

  @Get('revenue/daily')
  @ApiOperation({ summary: 'Báo cáo doanh thu theo chuỗi ngày gần nhất (mặc định 7 ngày)' })
  @ApiQuery({ name: 'days', type: Number, required: false, example: 7 })
  @ApiResponse({ status: 200, description: 'Lấy báo cáo doanh thu theo ngày thành công' })
  getDailyRevenue(@Query('days') days?: number) {
    return this.analyticsService.getDailyRevenue(days ? Number(days) : 7);
  }

  @Get('occupancy-by-type')
  @ApiOperation({ summary: 'Thống kê tỷ lệ lấp đầy theo từng loại phòng' })
  @ApiResponse({ status: 200, description: 'Lấy thống kê tỷ lệ lấp đầy theo hạng phòng thành công' })
  getOccupancyByType() {
    return this.analyticsService.getOccupancyByRoomType();
  }
}
