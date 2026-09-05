import { PrismaService } from '../prisma/prisma.service';
import { DailyRevenuePoint } from '../common/utils/revenue.util';
export declare class AnalyticsService {
    private prisma;
    constructor(prisma: PrismaService);
    getDashboardOverview(): Promise<{
        totalRevenueToday: number;
        todayRevenue: number;
        yesterdayRevenue: number;
        revenueChangePercent: number;
        occupancyRate: number;
        totalRooms: number;
        availableRooms: number;
        occupiedRooms: number;
        reservedRooms: number;
        cleaningRooms: number;
        maintenanceRooms: number;
        checkInsToday: number;
        todayCheckIns: number;
        checkOutsToday: number;
        todayCheckOuts: number;
        activeBookings: number;
        pendingBookings: number;
        pendingInvoicesCount: number;
        unpaidInvoices: number;
        roomStatusBreakdown: {
            AVAILABLE: number;
            OCCUPIED: number;
            RESERVED: number;
            CLEANING: number;
            MAINTENANCE: number;
        };
        revenue7Days: DailyRevenuePoint[];
        revenueRanges: Record<string, {
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
        availableRanges: number[];
        rooms: {
            total: number;
            available: number;
            occupied: number;
            reserved: number;
            cleaning: number;
            maintenance: number;
            occupancyRate: string;
        };
        todayActivity: {
            expectedCheckIns: number;
            expectedCheckOuts: number;
            activeBookings: number;
        };
        totalRevenue: number;
    }>;
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
