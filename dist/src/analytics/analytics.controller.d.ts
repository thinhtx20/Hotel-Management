import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getDashboard(): Promise<{
        totalRooms: number;
        availableRooms: number;
        occupiedRooms: number;
        reservedRooms: number;
        cleaningRooms: number;
        maintenanceRooms: number;
        occupancyRate: number;
        todayCheckIns: number;
        todayCheckOuts: number;
        activeBookings: number;
        todayRevenue: number;
        yesterdayRevenue: number;
        revenueChangePercent: number;
        pendingBookings: number;
        unpaidInvoices: number;
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
    getRevenue(year?: number): Promise<{
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
    getOccupancyByType(): Promise<{
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
