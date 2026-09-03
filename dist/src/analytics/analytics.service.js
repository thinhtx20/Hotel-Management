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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let AnalyticsService = class AnalyticsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardOverview() {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const [totalRooms, availableRooms, occupiedRooms, cleaningRooms, maintenanceRooms,] = await Promise.all([
            this.prisma.room.count(),
            this.prisma.room.count({ where: { status: client_1.RoomStatus.AVAILABLE } }),
            this.prisma.room.count({ where: { status: client_1.RoomStatus.OCCUPIED } }),
            this.prisma.room.count({ where: { status: client_1.RoomStatus.CLEANING } }),
            this.prisma.room.count({ where: { status: client_1.RoomStatus.MAINTENANCE } }),
        ]);
        const [todayCheckIns, todayCheckOuts, activeBookings] = await Promise.all([
            this.prisma.booking.count({
                where: {
                    checkInDate: { gte: todayStart, lte: todayEnd },
                    status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
                },
            }),
            this.prisma.booking.count({
                where: {
                    checkOutDate: { gte: todayStart, lte: todayEnd },
                    status: { in: [client_1.BookingStatus.CHECKED_IN, client_1.BookingStatus.CHECKED_OUT] },
                },
            }),
            this.prisma.booking.count({
                where: {
                    status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.CHECKED_IN] },
                },
            }),
        ]);
        const revenueAggregate = await this.prisma.invoice.aggregate({
            _sum: { paidAmount: true },
            where: { paymentStatus: client_1.PaymentStatus.PAID },
        });
        const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0';
        return {
            rooms: {
                total: totalRooms,
                available: availableRooms,
                occupied: occupiedRooms,
                cleaning: cleaningRooms,
                maintenance: maintenanceRooms,
                occupancyRate: `${occupancyRate}%`,
            },
            todayActivity: {
                expectedCheckIns: todayCheckIns,
                expectedCheckOuts: todayCheckOuts,
                activeBookings,
            },
            totalRevenue: revenueAggregate._sum.paidAmount || 0,
        };
    }
    async getRevenueAnalytics(year) {
        const targetYear = year || new Date().getFullYear();
        const startDate = new Date(targetYear, 0, 1);
        const endDate = new Date(targetYear, 11, 31, 23, 59, 59);
        const invoices = await this.prisma.invoice.findMany({
            where: {
                paidAt: { gte: startDate, lte: endDate },
                paymentStatus: client_1.PaymentStatus.PAID,
            },
            select: {
                roomAmount: true,
                servicesAmount: true,
                finalAmount: true,
                paidAt: true,
            },
        });
        const monthlyRevenue = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            totalRevenue: 0,
            roomRevenue: 0,
            serviceRevenue: 0,
            invoiceCount: 0,
        }));
        let totalYearRevenue = 0;
        let totalRoomRevenue = 0;
        let totalServicesRevenue = 0;
        invoices.forEach((inv) => {
            if (inv.paidAt) {
                const month = inv.paidAt.getMonth();
                monthlyRevenue[month].totalRevenue += inv.finalAmount;
                monthlyRevenue[month].roomRevenue += inv.roomAmount;
                monthlyRevenue[month].serviceRevenue += inv.servicesAmount;
                monthlyRevenue[month].invoiceCount += 1;
                totalYearRevenue += inv.finalAmount;
                totalRoomRevenue += inv.roomAmount;
                totalServicesRevenue += inv.servicesAmount;
            }
        });
        return {
            year: targetYear,
            summary: {
                totalYearRevenue,
                totalRoomRevenue,
                totalServicesRevenue,
                totalInvoices: invoices.length,
            },
            monthly: monthlyRevenue,
        };
    }
    async getOccupancyByRoomType() {
        const roomTypes = await this.prisma.roomType.findMany({
            include: {
                rooms: {
                    select: { status: true },
                },
            },
        });
        return roomTypes.map((rt) => {
            const total = rt.rooms.length;
            const occupied = rt.rooms.filter((r) => r.status === client_1.RoomStatus.OCCUPIED).length;
            const available = rt.rooms.filter((r) => r.status === client_1.RoomStatus.AVAILABLE).length;
            const rate = total > 0 ? ((occupied / total) * 100).toFixed(1) : '0';
            return {
                roomTypeId: rt.id,
                roomTypeName: rt.name,
                code: rt.code,
                basePrice: rt.basePrice,
                totalRooms: total,
                occupiedRooms: occupied,
                availableRooms: available,
                occupancyRate: `${rate}%`,
            };
        });
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map