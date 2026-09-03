import { PrismaService } from '../prisma/prisma.service';
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
        revenue7Days: {
            date: string;
            label: string;
            amount: number;
            revenue: number;
            invoiceCount: number;
        }[];
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
        series: {
            date: string;
            label: string;
            revenue: number;
            invoiceCount: number;
        }[];
        total: number;
        average: number;
        peak: {
            date: string;
            revenue: number;
        };
    }>;
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
}
