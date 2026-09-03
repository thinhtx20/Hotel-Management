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

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    // Thống kê phòng
    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      reservedRooms,
      cleaningRooms,
      maintenanceRooms,
    ] = await Promise.all([
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: RoomStatus.AVAILABLE } }),
      this.prisma.room.count({ where: { status: RoomStatus.OCCUPIED } }),
      this.prisma.room.count({ where: { status: RoomStatus.RESERVED } }),
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

    // Doanh thu và các chỉ số đếm (BE-6)
    const [
      allRevenueAggregate,
      todayRevenueAggregate,
      yesterdayRevenueAggregate,
      pendingBookings,
      unpaidInvoices,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: { paymentStatus: PaymentStatus.PAID },
      }),
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING },
      }),
      this.prisma.invoice.count({
        where: {
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        },
      }),
    ]);

    const todayRevenue = todayRevenueAggregate._sum.paidAmount || 0;
    const yesterdayRevenue = yesterdayRevenueAggregate._sum.paidAmount || 0;
    let revenueChangePercent: number | null = null;
    if (yesterdayRevenue > 0) {
      revenueChangePercent = Number(
        (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1),
      );
    }

    // occupancyRate là số thực (number), không kèm dấu % (BE-1)
    const occupancyRate = totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

    // Lấy chuỗi doanh thu 7 ngày gần nhất để nhúng trực tiếp vào Dashboard
    const dailyRev = await this.getDailyRevenue(7);
    const revenue7Days = dailyRev.series.map((s) => ({
      date: s.date,
      label: s.label,
      amount: s.revenue,
      revenue: s.revenue,
      invoiceCount: s.invoiceCount,
    }));

    const roomStatusBreakdown = {
      AVAILABLE: availableRooms,
      OCCUPIED: occupiedRooms,
      RESERVED: reservedRooms,
      CLEANING: cleaningRooms,
      MAINTENANCE: maintenanceRooms,
    };

    return {
      // Hợp đồng phẳng đầy đủ cho FE (BE-1, BE-6 & Claude Artifact Section 05)
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

      // Khối lồng cũ để giữ tương thích ngược
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
      totalRevenue: allRevenueAggregate._sum.paidAmount || 0,
    };
  }

  /**
   * Báo cáo doanh thu theo ngày (BE-5)
   * GET /analytics/revenue/daily?days=7
   */
  async getDailyRevenue(days: number = 7) {
    const numDays = Math.max(1, Math.min(days || 7, 90));

    const dayBuckets: { dateStr: string; label: string; start: Date; end: Date }[] = [];
    const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);

      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const day = String(start.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const label = weekdayLabels[start.getDay()];

      dayBuckets.push({ dateStr, label, start, end });
    }

    const rangeStart = dayBuckets[0].start;
    const rangeEnd = dayBuckets[dayBuckets.length - 1].end;

    const invoices = await this.prisma.invoice.findMany({
      where: {
        paidAt: { gte: rangeStart, lte: rangeEnd },
        paymentStatus: PaymentStatus.PAID,
      },
      select: {
        paidAmount: true,
        paidAt: true,
      },
    });

    const series = dayBuckets.map((bucket) => {
      let revenue = 0;
      let invoiceCount = 0;
      for (const inv of invoices) {
        if (inv.paidAt && inv.paidAt >= bucket.start && inv.paidAt <= bucket.end) {
          revenue += inv.paidAmount;
          invoiceCount += 1;
        }
      }
      return {
        date: bucket.dateStr,
        label: bucket.label,
        revenue,
        invoiceCount,
      };
    });

    const total = series.reduce((acc, item) => acc + item.revenue, 0);
    const average = numDays > 0 ? Math.round(total / numDays) : 0;

    let peak = series[0]
      ? { date: series[0].date, revenue: series[0].revenue }
      : { date: '', revenue: 0 };
    for (const item of series) {
      if (item.revenue > peak.revenue) {
        peak = { date: item.date, revenue: item.revenue };
      }
    }

    return {
      days: numDays,
      series,
      total,
      average,
      peak,
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
      const reserved = rt.rooms.filter((r) => r.status === RoomStatus.RESERVED).length;
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
}
