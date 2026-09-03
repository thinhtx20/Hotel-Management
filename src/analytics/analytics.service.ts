import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, PaymentStatus, RoomStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardOverview() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Thống kê phòng
    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      cleaningRooms,
      maintenanceRooms,
    ] = await Promise.all([
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: RoomStatus.AVAILABLE } }),
      this.prisma.room.count({ where: { status: RoomStatus.OCCUPIED } }),
      this.prisma.room.count({ where: { status: RoomStatus.CLEANING } }),
      this.prisma.room.count({ where: { status: RoomStatus.MAINTENANCE } }),
    ]);

    // Thống kê khách đến & đi hôm nay
    const [todayCheckIns, todayCheckOuts, activeBookings] = await Promise.all([
      this.prisma.booking.count({
        where: {
          checkInDate: { gte: todayStart, lte: todayEnd },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        },
      }),
      this.prisma.booking.count({
        where: {
          checkOutDate: { gte: todayStart, lte: todayEnd },
          status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        },
      }),
    ]);

    // Tổng doanh thu đã thu
    const revenueAggregate = await this.prisma.invoice.aggregate({
      _sum: { paidAmount: true },
      where: { paymentStatus: PaymentStatus.PAID },
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

  async getRevenueAnalytics(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        paidAt: { gte: startDate, lte: endDate },
        paymentStatus: PaymentStatus.PAID,
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
      const occupied = rt.rooms.filter((r) => r.status === RoomStatus.OCCUPIED).length;
      const available = rt.rooms.filter((r) => r.status === RoomStatus.AVAILABLE).length;
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
}
