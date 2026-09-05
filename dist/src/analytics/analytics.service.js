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
const revenue_util_1 = require("../common/utils/revenue.util");
let AnalyticsService = class AnalyticsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardOverview() {
        const today = new Date();
        const todayStart = (0, revenue_util_1.startOfDay)(today);
        const todayEnd = (0, revenue_util_1.endOfDay)(today);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStart = (0, revenue_util_1.startOfDay)(yesterday);
        const yesterdayEnd = (0, revenue_util_1.endOfDay)(yesterday);
        const [totalRooms, availableRooms, occupiedRooms, reservedRooms, cleaningRooms, maintenanceRooms,] = await Promise.all([
            this.prisma.room.count(),
            this.prisma.room.count({ where: { status: client_1.RoomStatus.AVAILABLE } }),
            this.prisma.room.count({ where: { status: client_1.RoomStatus.OCCUPIED } }),
            this.prisma.room.count({ where: { status: client_1.RoomStatus.RESERVED } }),
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
        const [allRevenueAggregate, todayRevenueAggregate, yesterdayRevenueAggregate, pendingBookings, unpaidInvoices,] = await Promise.all([
            this.prisma.invoice.aggregate({
                _sum: { paidAmount: true },
                where: { paymentStatus: { in: revenue_util_1.COLLECTED_PAYMENT_STATUSES } },
            }),
            this.prisma.invoice.aggregate({
                _sum: { paidAmount: true },
                where: (0, revenue_util_1.collectedRevenueWhere)(todayStart, todayEnd),
            }),
            this.prisma.invoice.aggregate({
                _sum: { paidAmount: true },
                where: (0, revenue_util_1.collectedRevenueWhere)(yesterdayStart, yesterdayEnd),
            }),
            this.prisma.booking.count({
                where: { status: client_1.BookingStatus.PENDING },
            }),
            this.prisma.invoice.count({
                where: {
                    paymentStatus: { in: [client_1.PaymentStatus.UNPAID, client_1.PaymentStatus.PARTIAL] },
                },
            }),
        ]);
        const todayRevenue = (0, revenue_util_1.roundMoney)(todayRevenueAggregate._sum.paidAmount || 0);
        const yesterdayRevenue = (0, revenue_util_1.roundMoney)(yesterdayRevenueAggregate._sum.paidAmount || 0);
        let revenueChangePercent = null;
        if (yesterdayRevenue > 0) {
            revenueChangePercent = Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1));
        }
        const occupancyRate = totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;
        const dailyRev = await this.getDailyRevenue(revenue_util_1.DEFAULT_REVENUE_RANGE);
        const revenue7Days = dailyRev.series;
        const roomStatusBreakdown = {
            AVAILABLE: availableRooms,
            OCCUPIED: occupiedRooms,
            RESERVED: reservedRooms,
            CLEANING: cleaningRooms,
            MAINTENANCE: maintenanceRooms,
        };
        return {
            totalRevenueToday: todayRevenue,
            todayRevenue,
            yesterdayRevenue,
            revenueChangePercent,
            occupancyRate,
            totalRooms,
            availableRooms,
            occupiedRooms,
            reservedRooms,
            cleaningRooms,
            maintenanceRooms,
            checkInsToday: todayCheckIns,
            todayCheckIns,
            checkOutsToday: todayCheckOuts,
            todayCheckOuts,
            activeBookings,
            pendingBookings,
            pendingInvoicesCount: unpaidInvoices,
            unpaidInvoices,
            roomStatusBreakdown,
            revenue7Days,
            revenueRanges: dailyRev.ranges,
            availableRanges: revenue_util_1.REVENUE_RANGES,
            rooms: {
                total: totalRooms,
                available: availableRooms,
                occupied: occupiedRooms,
                reserved: reservedRooms,
                cleaning: cleaningRooms,
                maintenance: maintenanceRooms,
                occupancyRate: `${occupancyRate}%`,
            },
            todayActivity: {
                expectedCheckIns: todayCheckIns,
                expectedCheckOuts: todayCheckOuts,
                activeBookings,
            },
            totalRevenue: (0, revenue_util_1.roundMoney)(allRevenueAggregate._sum.paidAmount || 0),
        };
    }
    async getDailyRevenue(days = revenue_util_1.DEFAULT_REVENUE_RANGE) {
        const range = (0, revenue_util_1.normalizeRevenueRange)(days);
        const maxRange = Math.max(range, ...revenue_util_1.REVENUE_RANGES);
        const buckets = (0, revenue_util_1.buildDayBuckets)(maxRange * 2);
        const invoices = await this.prisma.invoice.findMany({
            where: (0, revenue_util_1.collectedRevenueWhere)(buckets[0].start, buckets[buckets.length - 1].end),
            select: {
                paidAmount: true,
                paidAt: true,
            },
        });
        const byDate = new Map();
        for (const inv of invoices) {
            if (!inv.paidAt)
                continue;
            const key = (0, revenue_util_1.formatLocalDate)(inv.paidAt);
            const entry = byDate.get(key) || { revenue: 0, invoiceCount: 0 };
            entry.revenue += inv.paidAmount;
            entry.invoiceCount += 1;
            byDate.set(key, entry);
        }
        const allDays = buckets.map((bucket) => {
            const entry = byDate.get(bucket.date);
            const revenue = (0, revenue_util_1.roundMoney)(entry?.revenue || 0);
            return {
                date: bucket.date,
                label: bucket.label,
                dateLabel: bucket.dateLabel,
                revenue,
                amount: revenue,
                invoiceCount: entry?.invoiceCount || 0,
            };
        });
        const ranges = {};
        for (const preset of revenue_util_1.REVENUE_RANGES) {
            ranges[preset] = this.summarizeRange(allDays, preset);
        }
        return {
            ...this.summarizeRange(allDays, range),
            days: range,
            availableRanges: revenue_util_1.REVENUE_RANGES,
            ranges,
        };
    }
    summarizeRange(allDays, range) {
        const series = allDays.slice(-range);
        const previous = allDays.slice(-range * 2, -range);
        const total = (0, revenue_util_1.roundMoney)(series.reduce((acc, d) => acc + d.revenue, 0));
        const previousTotal = (0, revenue_util_1.roundMoney)(previous.reduce((acc, d) => acc + d.revenue, 0));
        const average = series.length > 0 ? (0, revenue_util_1.roundMoney)(total / series.length) : 0;
        let peak = { date: '', revenue: 0 };
        for (const point of series) {
            if (!peak.date || point.revenue > peak.revenue) {
                peak = { date: point.date, revenue: point.revenue };
            }
        }
        const changePercent = previousTotal > 0
            ? Number((((total - previousTotal) / previousTotal) * 100).toFixed(1))
            : null;
        return {
            range,
            from: series[0]?.date || '',
            to: series[series.length - 1]?.date || '',
            series,
            total,
            average,
            peak,
            previousTotal,
            changePercent,
            invoiceCount: series.reduce((acc, d) => acc + d.invoiceCount, 0),
        };
    }
    async getRevenueAnalytics(year) {
        const targetYear = year || new Date().getFullYear();
        const startDate = (0, revenue_util_1.startOfDay)(new Date(targetYear, 0, 1));
        const endDate = (0, revenue_util_1.endOfDay)(new Date(targetYear, 11, 31));
        const invoices = await this.prisma.invoice.findMany({
            where: (0, revenue_util_1.collectedRevenueWhere)(startDate, endDate),
            select: {
                roomAmount: true,
                servicesAmount: true,
                finalAmount: true,
                paidAmount: true,
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
            if (!inv.paidAt)
                return;
            const collectedRatio = inv.finalAmount > 0 ? Math.min(inv.paidAmount / inv.finalAmount, 1) : 0;
            const month = inv.paidAt.getMonth();
            monthlyRevenue[month].totalRevenue += inv.paidAmount;
            monthlyRevenue[month].roomRevenue += inv.roomAmount * collectedRatio;
            monthlyRevenue[month].serviceRevenue += inv.servicesAmount * collectedRatio;
            monthlyRevenue[month].invoiceCount += 1;
            totalYearRevenue += inv.paidAmount;
            totalRoomRevenue += inv.roomAmount * collectedRatio;
            totalServicesRevenue += inv.servicesAmount * collectedRatio;
        });
        monthlyRevenue.forEach((m) => {
            m.totalRevenue = (0, revenue_util_1.roundMoney)(m.totalRevenue);
            m.roomRevenue = (0, revenue_util_1.roundMoney)(m.roomRevenue);
            m.serviceRevenue = (0, revenue_util_1.roundMoney)(m.serviceRevenue);
        });
        return {
            year: targetYear,
            summary: {
                totalYearRevenue: (0, revenue_util_1.roundMoney)(totalYearRevenue),
                totalRoomRevenue: (0, revenue_util_1.roundMoney)(totalRoomRevenue),
                totalServicesRevenue: (0, revenue_util_1.roundMoney)(totalServicesRevenue),
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
            const reserved = rt.rooms.filter((r) => r.status === client_1.RoomStatus.RESERVED).length;
            const rate = total > 0 ? ((occupied / total) * 100).toFixed(1) : '0';
            return {
                roomTypeId: rt.id,
                roomTypeName: rt.name,
                code: rt.code,
                basePrice: rt.basePrice,
                totalRooms: total,
                occupiedRooms: occupied,
                availableRooms: available,
                reservedRooms: reserved,
                occupancyRate: `${rate}%`,
            };
        });
    }
    async getStaffPerformance(from, to) {
        const today = new Date();
        const startDate = from ? (0, revenue_util_1.startOfDay)(new Date(from)) : (0, revenue_util_1.startOfDay)(new Date(today.getFullYear(), today.getMonth(), 1));
        const endDate = to ? (0, revenue_util_1.endOfDay)(new Date(to)) : (0, revenue_util_1.endOfDay)(today);
        const staffUsers = await this.prisma.user.findMany({
            where: {
                role: { in: [client_1.Role.ADMIN, client_1.Role.RECEPTIONIST] },
                isActive: true,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
            },
            orderBy: { fullName: 'asc' },
        });
        const staffData = await Promise.all(staffUsers.map(async (user) => {
            const [bookingsConfirmed, bookingsCancelled, invoicesIssued, paidAgg] = await Promise.all([
                this.prisma.booking.count({
                    where: {
                        confirmedById: user.id,
                        confirmedAt: { gte: startDate, lte: endDate },
                    },
                }),
                this.prisma.booking.count({
                    where: {
                        cancelledById: user.id,
                        cancelledAt: { gte: startDate, lte: endDate },
                    },
                }),
                this.prisma.invoice.count({
                    where: {
                        issuedById: user.id,
                        createdAt: { gte: startDate, lte: endDate },
                    },
                }),
                this.prisma.invoice.aggregate({
                    _sum: { paidAmount: true },
                    where: {
                        issuedById: user.id,
                        paidAt: { gte: startDate, lte: endDate },
                    },
                }),
            ]);
            return {
                userId: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                bookingsConfirmed,
                bookingsCancelled,
                invoicesIssued,
                amountCollected: (0, revenue_util_1.roundMoney)(paidAgg._sum.paidAmount || 0),
            };
        }));
        const totals = staffData.reduce((acc, curr) => ({
            bookingsConfirmed: acc.bookingsConfirmed + curr.bookingsConfirmed,
            bookingsCancelled: acc.bookingsCancelled + curr.bookingsCancelled,
            invoicesIssued: acc.invoicesIssued + curr.invoicesIssued,
            amountCollected: (0, revenue_util_1.roundMoney)(acc.amountCollected + curr.amountCollected),
        }), { bookingsConfirmed: 0, bookingsCancelled: 0, invoicesIssued: 0, amountCollected: 0 });
        return {
            from: (0, revenue_util_1.formatLocalDate)(startDate),
            to: (0, revenue_util_1.formatLocalDate)(endDate),
            staff: staffData,
            totals,
        };
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map