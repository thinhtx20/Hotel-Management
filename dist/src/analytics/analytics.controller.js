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
const api_success_response_decorator_1 = require("../common/decorators/api-success-response.decorator");
const revenue_util_1 = require("../common/utils/revenue.util");
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
    getDailyRevenue(range, days) {
        const selected = range ?? days;
        return this.analyticsService.getDailyRevenue(selected !== undefined ? Number(selected) : revenue_util_1.DEFAULT_REVENUE_RANGE);
    }
    getOccupancyByType() {
        return this.analyticsService.getOccupancyByRoomType();
    }
    getStaffPerformance(from, to) {
        return this.analyticsService.getStaffPerformance(from, to);
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({
        summary: 'Tổng quan chỉ số phòng, khách hôm nay và tỷ lệ lấp đầy',
        description: 'Dùng chung cho cả hai vai trò nhân viên (ADMIN và RECEPTIONIST).',
    }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
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
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getDashboard", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)('revenue'),
    (0, swagger_1.ApiOperation)({ summary: 'Báo cáo doanh thu theo năm và biểu đồ 12 tháng (Chỉ Admin)' }),
    (0, swagger_1.ApiQuery)({ name: 'year', type: Number, required: false, example: 2026 }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
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
    }),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getRevenue", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Get)('revenue/daily'),
    (0, swagger_1.ApiOperation)({
        summary: 'Doanh thu theo ngày, chia sẵn 4 khoảng 1 / 7 / 14 / 30 ngày (mặc định 7)',
        description: 'Trả về cùng lúc cả 4 khoảng chuẩn trong `ranges` để FE bấm chip lọc là đổi ngay, ' +
            'không phải gọi lại API. `series` / `total` / `average` / `peak` ở cấp ngoài ứng với ' +
            'khoảng đang chọn qua `?range=`. Doanh thu là **tiền thực thu** (`paidAmount`) ghi nhận ' +
            'theo ngày thanh toán, tính cả hóa đơn thu một phần (PARTIAL).',
    }),
    (0, swagger_1.ApiQuery)({ name: 'range', type: Number, required: false, enum: revenue_util_1.REVENUE_RANGES, example: 7 }),
    (0, swagger_1.ApiQuery)({ name: 'days', type: Number, required: false, example: 7, description: 'Alias cũ của range' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
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
    }),
    __param(0, (0, common_1.Query)('range')),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getDailyRevenue", null);
__decorate([
    (0, common_1.Get)('occupancy-by-type'),
    (0, swagger_1.ApiOperation)({ summary: 'Thống kê tỷ lệ lấp đầy theo từng loại phòng' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
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
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getOccupancyByType", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)('staff-performance'),
    (0, swagger_1.ApiOperation)({
        summary: 'Báo cáo hiệu suất công việc nhân sự lễ tân & thu ngân (Chỉ Admin)',
        description: 'Thống kê số đơn đặt phòng xác nhận/hủy, số hóa đơn phát hành và tổng số tiền thu được theo từng nhân viên.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false, example: '2026-09-01', description: 'Ngày bắt đầu (YYYY-MM-DD)' }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false, example: '2026-09-05', description: 'Ngày kết thúc (YYYY-MM-DD)' }),
    (0, api_success_response_decorator_1.ApiSuccessResponse)({
        status: 200,
        description: 'Lấy báo cáo hiệu suất nhân sự thành công',
        exampleData: {
            from: '2026-09-01',
            to: '2026-09-05',
            staff: [
                {
                    userId: 'user-uuid',
                    fullName: 'Lê Thu Hà',
                    email: 'reception@hotel.com',
                    role: 'RECEPTIONIST',
                    bookingsConfirmed: 34,
                    bookingsCancelled: 2,
                    invoicesIssued: 41,
                    amountCollected: 128500000,
                },
            ],
            totals: {
                bookingsConfirmed: 34,
                bookingsCancelled: 2,
                invoicesIssued: 41,
                amountCollected: 128500000,
            },
        },
    }),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getStaffPerformance", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('Analytics & Dashboard (Báo cáo & Thống kê)'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.RECEPTIONIST),
    (0, common_1.Controller)('analytics'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map