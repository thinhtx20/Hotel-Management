import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  getDashboard() {
    return this.analyticsService.getDashboardOverview();
  }

  @Roles(Role.ADMIN)
  @Get('revenue')
  @ApiOperation({ summary: 'Báo cáo doanh thu theo năm và biểu đồ 12 tháng (Chỉ Admin)' })
  @ApiQuery({ name: 'year', type: Number, required: false, example: 2026 })
  getRevenue(@Query('year') year?: number) {
    return this.analyticsService.getRevenueAnalytics(year ? Number(year) : undefined);
  }

  @Get('occupancy-by-type')
  @ApiOperation({ summary: 'Thống kê tỷ lệ lấp đầy theo từng loại phòng' })
  getOccupancyByType() {
    return this.analyticsService.getOccupancyByRoomType();
  }
}
