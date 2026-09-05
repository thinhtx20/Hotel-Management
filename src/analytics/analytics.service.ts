import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, PaymentStatus, RoomStatus, Role } from '@prisma/client';
import {
  COLLECTED_PAYMENT_STATUSES,
  DEFAULT_REVENUE_RANGE,
  DailyRevenuePoint,
  REVENUE_RANGES,
  buildDayBuckets,
  collectedRevenueWhere,
  endOfDay,
  formatLocalDate,
  normalizeRevenueRange,
  roundMoney,
  startOfDay,
} from '../common/utils/revenue.util';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardOverview() {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);

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
        where: { paymentStatus: { in: COLLECTED_PAYMENT_STATUSES } },
      }),
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: collectedRevenueWhere(todayStart, todayEnd),
      }),
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: collectedRevenueWhere(yesterdayStart, yesterdayEnd),
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

    const todayRevenue = roundMoney(todayRevenueAggregate._sum.paidAmount || 0);
    const yesterdayRevenue = roundMoney(yesterdayRevenueAggregate._sum.paidAmount || 0);
    let revenueChangePercent: number | null = null;
    if (yesterdayRevenue > 0) {
      revenueChangePercent = Number(
        (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1),
      );
    }

    // occupancyRate là số thực (number), không kèm dấu % (BE-1)
    const occupancyRate = totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

    // Chuỗi doanh thu theo ngày nhúng thẳng vào Dashboard, đủ cả 4 khoảng
    // 1/7/14/30 để FE đổi chip lọc mà không phải gọi lại API.
    const dailyRev = await this.getDailyRevenue(DEFAULT_REVENUE_RANGE);
    const revenue7Days = dailyRev.series;

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
      revenueRanges: dailyRev.ranges,
      availableRanges: REVENUE_RANGES,

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
      totalRevenue: roundMoney(allRevenueAggregate._sum.paidAmount || 0),
    };
  }

  /**
   * Báo cáo doanh thu theo ngày (BE-5)
   * GET /analytics/revenue/daily?range=1|7|14|30  (alias cũ: ?days=)
   *
   * Một lần gọi trả về đủ cả 4 khoảng chuẩn trong `ranges`, nên FE bấm chip
   * "Hôm nay / 7 ngày / 14 ngày / 30 ngày" là đổi được ngay, không gọi lại API.
   * `series`, `total`, `average`, `peak` ở cấp ngoài là khoảng đang chọn —
   * giữ nguyên tên cũ để client đang chạy không phải sửa gì.
   */
  async getDailyRevenue(days: number = DEFAULT_REVENUE_RANGE) {
    const range = normalizeRevenueRange(days);
    const maxRange = Math.max(range, ...REVENUE_RANGES);

    // Nạp gấp đôi khoảng dài nhất để còn dữ liệu kỳ liền trước mà so sánh %.
    const buckets = buildDayBuckets(maxRange * 2);

    const invoices = await this.prisma.invoice.findMany({
      where: collectedRevenueWhere(
        buckets[0].start,
        buckets[buckets.length - 1].end,
      ),
      select: {
        paidAmount: true,
        paidAt: true,
      },
    });

    // Dồn tiền theo ngày thanh toán, một lượt O(n) thay vì quét lại từng ô ngày.
    const byDate = new Map<string, { revenue: number; invoiceCount: number }>();
    for (const inv of invoices) {
      if (!inv.paidAt) continue;
      const key = formatLocalDate(inv.paidAt);
      const entry = byDate.get(key) || { revenue: 0, invoiceCount: 0 };
      entry.revenue += inv.paidAmount;
      entry.invoiceCount += 1;
      byDate.set(key, entry);
    }

    const allDays: DailyRevenuePoint[] = buckets.map((bucket) => {
      const entry = byDate.get(bucket.date);
      const revenue = roundMoney(entry?.revenue || 0);
      return {
        date: bucket.date,
        label: bucket.label,
        dateLabel: bucket.dateLabel,
        revenue,
        amount: revenue, // alias cho FE đang đọc `amount`
        invoiceCount: entry?.invoiceCount || 0,
      };
    });

    const ranges: Record<string, ReturnType<AnalyticsService['summarizeRange']>> = {};
    for (const preset of REVENUE_RANGES) {
      ranges[preset] = this.summarizeRange(allDays, preset);
    }

    return {
      ...this.summarizeRange(allDays, range),
      days: range, // tên cũ, giữ tương thích ngược
      availableRanges: REVENUE_RANGES,
      ranges,
    };
  }

  /**
   * Cắt `range` ngày cuối của chuỗi và tổng hợp lại, kèm kỳ liền trước
   * (`range` ngày ngay trước đó) để tính % tăng giảm.
   */
  private summarizeRange(allDays: DailyRevenuePoint[], range: number) {
    const series = allDays.slice(-range);
    const previous = allDays.slice(-range * 2, -range);

    const total = roundMoney(series.reduce((acc, d) => acc + d.revenue, 0));
    const previousTotal = roundMoney(
      previous.reduce((acc, d) => acc + d.revenue, 0),
    );
    const average = series.length > 0 ? roundMoney(total / series.length) : 0;

    let peak = { date: '', revenue: 0 };
    for (const point of series) {
      if (!peak.date || point.revenue > peak.revenue) {
        peak = { date: point.date, revenue: point.revenue };
      }
    }

    const changePercent =
      previousTotal > 0
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

  async getRevenueAnalytics(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const startDate = startOfDay(new Date(targetYear, 0, 1));
    const endDate = endOfDay(new Date(targetYear, 11, 31));

    const invoices = await this.prisma.invoice.findMany({
      where: collectedRevenueWhere(startDate, endDate),
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
      if (!inv.paidAt) return;

      // Hóa đơn PARTIAL mới thu một phần: chia tiền phòng / dịch vụ theo đúng
      // tỷ lệ đã thu, để tổng ba con số luôn khớp với số tiền thực vào két.
      const collectedRatio =
        inv.finalAmount > 0 ? Math.min(inv.paidAmount / inv.finalAmount, 1) : 0;

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
      m.totalRevenue = roundMoney(m.totalRevenue);
      m.roomRevenue = roundMoney(m.roomRevenue);
      m.serviceRevenue = roundMoney(m.serviceRevenue);
    });

    return {
      year: targetYear,
      summary: {
        totalYearRevenue: roundMoney(totalYearRevenue),
        totalRoomRevenue: roundMoney(totalRoomRevenue),
        totalServicesRevenue: roundMoney(totalServicesRevenue),
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

  /**
   * Báo cáo hiệu suất nhân sự (A1 - P1)
   * GET /analytics/staff-performance?from=&to=
   */
  async getStaffPerformance(from?: string, to?: string) {
    const today = new Date();
    const startDate = from ? startOfDay(new Date(from)) : startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
    const endDate = to ? endOfDay(new Date(to)) : endOfDay(today);

    // Lấy danh sách nhân viên (ADMIN & RECEPTIONIST)
    const staffUsers = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.RECEPTIONIST] },
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

    const staffData = await Promise.all(
      staffUsers.map(async (user) => {
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
          amountCollected: roundMoney(paidAgg._sum.paidAmount || 0),
        };
      }),
    );

    const totals = staffData.reduce(
      (acc, curr) => ({
        bookingsConfirmed: acc.bookingsConfirmed + curr.bookingsConfirmed,
        bookingsCancelled: acc.bookingsCancelled + curr.bookingsCancelled,
        invoicesIssued: acc.invoicesIssued + curr.invoicesIssued,
        amountCollected: roundMoney(acc.amountCollected + curr.amountCollected),
      }),
      { bookingsConfirmed: 0, bookingsCancelled: 0, invoicesIssued: 0, amountCollected: 0 },
    );

    return {
      from: formatLocalDate(startDate),
      to: formatLocalDate(endDate),
      staff: staffData,
      totals,
    };
  }
}
