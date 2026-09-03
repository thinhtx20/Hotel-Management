import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getDashboard(): Promise<{
        rooms: {
            total: number;
            available: number;
            occupied: number;
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
    getOccupancyByType(): Promise<{
        roomTypeId: string;
        roomTypeName: string;
        code: string;
        basePrice: number;
        totalRooms: number;
        occupiedRooms: number;
        availableRooms: number;
        occupancyRate: string;
    }[]>;
}
