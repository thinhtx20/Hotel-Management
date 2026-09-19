import { PrismaService } from '../prisma/prisma.service';
import { DailyRevenuePoint } from '../common/utils/revenue.util';
import { RedisService } from '../redis/redis.service';
export declare class AnalyticsService {
    private prisma;
    private redis;
    constructor(prisma: PrismaService, redis: RedisService);
    getDashboardOverview(): Promise<any>;
    getDailyRevenue(days?: number): Promise<{
        days: number;
        availableRanges: number[];
        ranges: Record<string, {
            range: number;
            from: string;
            to: string;
            series: DailyRevenuePoint[];
            total: number;
            average: number;
            peak: {
                date: string;
                revenue: number;
            };
            previousTotal: number;
            changePercent: number;
            invoiceCount: number;
        }>;
        range: number;
        from: string;
        to: string;
        series: DailyRevenuePoint[];
        total: number;
        average: number;
        peak: {
            date: string;
            revenue: number;
        };
        previousTotal: number;
        changePercent: number;
        invoiceCount: number;
    }>;
    private summarizeRange;
    getRevenueAnalytics(year?: number): Promise<{
        year: number;
        summary: {
            totalYearRevenue: number;
            totalRoomRevenue: number;
            totalServicesRevenue: number;
            totalInvoices: number;
        };
        monthly: {
            month: number;
            totalRevenue: number;
            roomRevenue: number;
            serviceRevenue: number;
            invoiceCount: number;
        }[];
    }>;
    getOccupancyByRoomType(): Promise<{
        roomTypeId: string;
        roomTypeName: string;
        code: string;
        basePrice: number;
        totalRooms: number;
        occupiedRooms: number;
        availableRooms: number;
        reservedRooms: number;
        occupancyRate: string;
    }[]>;
    getStaffPerformance(from?: string, to?: string): Promise<{
        from: string;
        to: string;
        staff: {
            userId: string;
            fullName: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            bookingsConfirmed: number;
            bookingsCancelled: number;
            invoicesIssued: number;
            amountCollected: number;
        }[];
        totals: {
            bookingsConfirmed: number;
            bookingsCancelled: number;
            invoicesIssued: number;
            amountCollected: number;
        };
    }>;
}
