"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const analytics_service_1 = require("./analytics.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let AnalyticsController = class AnalyticsController {
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    getDashboard() {
        return this.analyticsService.getDashboardOverview();
    }
    getRevenue(year) {
        return this.analyticsService.getRevenueAnalytics(year ? Number(year) : undefined);
    }
    getDailyRevenue(days) {
        return this.analyticsService.getDailyRevenue(days ? Number(days) : 7);
    }
    getOccupancyByType() {
        return this.analyticsService.getOccupancyByRoomType();
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Tổng quan chỉ số phòng, khách hôm nay và tỷ lệ lấp đầy' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lấy dữ liệu tổng quan Dashboard thành công' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getDashboard", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)('revenue'),
    (0, swagger_1.ApiOperation)({ summary: 'Báo cáo doanh thu theo năm và biểu đồ 12 tháng (Chỉ Admin)' }),
    (0, swagger_1.ApiQuery)({ name: 'year', type: Number, required: false, example: 2026 }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lấy báo cáo doanh thu theo năm thành công' }),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getRevenue", null);
__decorate([
    (0, common_1.Get)('revenue/daily'),
    (0, swagger_1.ApiOperation)({ summary: 'Báo cáo doanh thu theo chuỗi ngày gần nhất (mặc định 7 ngày)' }),
    (0, swagger_1.ApiQuery)({ name: 'days', type: Number, required: false, example: 7 }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lấy báo cáo doanh thu theo ngày thành công' }),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getDailyRevenue", null);
__decorate([
    (0, common_1.Get)('occupancy-by-type'),
    (0, swagger_1.ApiOperation)({ summary: 'Thống kê tỷ lệ lấp đầy theo từng loại phòng' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lấy thống kê tỷ lệ lấp đầy theo hạng phòng thành công' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getOccupancyByType", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('Analytics & Dashboard (Báo cáo & Thống kê)'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Controller)('analytics'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map