import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  Role,
} from '@prisma/client';

/**
 * DỮ LIỆU LỊCH SỬ CHO BÁO CÁO (Doanh thu 12 tháng + Hiệu suất nhân sự A1)
 * ----------------------------------------------------------------------
 * Màn "Báo cáo & Hiệu suất" đọc từ hai endpoint:
 *   - GET /analytics/revenue?year=YYYY        -> gom `paidAmount` theo `paidAt`
 *   - GET /analytics/staff-performance?from&to-> đếm `confirmedAt` / `cancelledAt`
 *                                                / `invoice.createdAt` / `invoice.paidAt`
 *
 * Cả hai chỉ có số khi trong CSDL tồn tại đơn đã xác nhận và hóa đơn đã thu tiền
 * rơi đúng vào khoảng thời gian đang xem. Dữ liệu mẫu gốc chỉ có vài đơn quanh
 * ngày hiện tại nên chọn năm 2024/2025 là biểu đồ trống trơn.
 *
 * File này dựng lại "quá khứ kinh doanh" của khách sạn cho các năm trong
 * HISTORY_YEARS: mỗi tháng một lượng đơn theo mùa du lịch, đơn nào cũng có người
 * xác nhận và hóa đơn có người phát hành, nên cả biểu đồ doanh thu lẫn bảng hiệu
 * suất nhân sự đều có số thật để hiển thị.
 *
 * Toàn bộ số liệu sinh ra từ một bộ sinh số giả ngẫu nhiên có hạt giống cố định
 * (mã năm), nên chạy lại bao nhiêu lần vẫn ra đúng một bộ dữ liệu.
 */

/** Các năm được dựng dữ liệu lịch sử. Muốn thêm năm chỉ cần thêm vào mảng này. */
export const HISTORY_YEARS = [2024, 2025];

/**
 * Hệ số mùa vụ 12 tháng của khách sạn nghỉ dưỡng ven biển:
 * cao điểm hè (T6–T8) và Tết (T2), thấp điểm mùa mưa (T9–T10).
 */
const MONTH_WEIGHTS = [
  0.90, // T1
  1.15, // T2 - Tết Nguyên đán
  0.85, // T3
  1.00, // T4
  1.20, // T5
  1.35, // T6
  1.45, // T7 - cao điểm hè
  1.40, // T8
  0.80, // T9
  0.75, // T10 - thấp điểm mùa mưa
  0.90, // T11
  1.20, // T12 - Giáng sinh & Tết dương lịch
];

/** Quy mô kinh doanh từng năm: số đơn nền mỗi tháng và mặt bằng giá. */
const YEAR_PROFILE: Record<number, { baseBookings: number; priceFactor: number }> = {
  2024: { baseBookings: 18, priceFactor: 1.0 },
  2025: { baseBookings: 23, priceFactor: 1.08 }, // năm sau tăng trưởng cả lượng khách lẫn giá phòng
};

const DEFAULT_YEAR_PROFILE = { baseBookings: 20, priceFactor: 1.0 };

/** Danh mục dịch vụ phát sinh dùng để dựng phần `servicesAmount` của hóa đơn. */
const SERVICE_CATALOG = [
  { serviceName: 'Buffet sáng quốc tế phục vụ tại phòng', unitPrice: 250000, maxQty: 3 },
  { serviceName: 'Liệu trình Massage & Spa trị liệu (60 phút)', unitPrice: 500000, maxQty: 2 },
  { serviceName: 'Xe Limousine đưa đón sân bay 2 chiều', unitPrice: 800000, maxQty: 1 },
  { serviceName: 'Giặt ủi lấy nhanh trong ngày', unitPrice: 150000, maxQty: 3 },
  { serviceName: 'Minibar trọn gói (bia, nước, snack)', unitPrice: 150000, maxQty: 2 },
  { serviceName: 'Trà chiều hoàng gia cho 2 người', unitPrice: 180000, maxQty: 2 },
  { serviceName: 'Thuê xe máy tay ga tham quan', unitPrice: 150000, maxQty: 2 },
  { serviceName: 'Rượu vang đỏ Chile (chai 750ml)', unitPrice: 650000, maxQty: 1 },
  { serviceName: 'Nước suối khoáng & trái cây theo mùa', unitPrice: 80000, maxQty: 4 },
];

const SPECIAL_REQUESTS = [
  'Xin phòng tầng cao, yên tĩnh',
  'Kỷ niệm ngày cưới, cần trang trí hoa',
  'Đi công tác, cần hóa đơn VAT cho công ty',
  'Gia đình có trẻ nhỏ, cần thêm nôi em bé',
  'Nhận phòng sớm trước 12h nếu còn phòng trống',
  'Cần thêm gối và chăn mỏng',
  null,
  null,
];

const CANCEL_REASONS = [
  'Khách đổi lịch bay phút chót nên xin hủy phòng',
  'Khách báo bận công việc đột xuất, hủy trước ngày nhận phòng',
  'Trùng lịch đặt phòng, khách giữ lại một đơn duy nhất',
  'Thời tiết xấu, đoàn khách hoãn chuyến đi',
  'Khách chuyển sang hạng phòng khác nên hủy đơn cũ',
];

const PAYMENT_METHOD_POOL = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CREDIT_CARD,
];

/**
 * Tải công việc tương đối giữa các nhân viên. Nhân sự thứ i lấy trọng số thứ
 * (i % length) — nhờ vậy bảng hiệu suất có người nhiều việc, người ít việc thay
 * vì chia đều tuyệt đối trông như dữ liệu giả.
 */
const CONFIRM_WEIGHTS = [1, 1, 6, 5, 3, 4];
const ISSUE_WEIGHTS = [1, 1, 3, 3, 6, 5];

export interface HistorySeedOptions {
  /** Danh sách năm cần dựng. Mặc định HISTORY_YEARS. */
  years?: number[];
  /** Ghi log tiến độ (console.log của seed.ts hoặc Logger của Nest). */
  log?: (message: string) => void;
  /** true = xóa và dựng lại dù năm đó đã có dữ liệu. */
  force?: boolean;
}

export interface HistoryYearSummary {
  year: number;
  skipped: boolean;
  bookings: number;
  invoices: number;
  serviceOrders: number;
  revenue: number;
}

/** Bộ sinh số giả ngẫu nhiên (mulberry32) — cùng hạt giống thì cùng kết quả. */
function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Chọn phòng theo phân bố thực tế: phòng hạng thấp bán chạy nhất, Suite và
 * Penthouse thi thoảng mới có khách. Nếu bốc phòng đều tay thì tháng nào trúng
 * vài đêm Penthouse là biểu đồ doanh thu vọt lên bất thường.
 */
function pickRoom<T extends { roomType: { basePrice: number } }>(
  rng: () => number,
  rooms: T[],
): T {
  const sorted = [...rooms].sort((a, b) => a.roomType.basePrice - b.roomType.basePrice);
  const index = Math.floor(Math.pow(rng(), 1.8) * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)];
}

/** Sinh UUID v4 hợp lệ từ rng để biết trước id mà nối booking <-> invoice. */
function makeId(rng: () => number): string {
  const hex = '0123456789abcdef';
  const chars: string[] = [];
  for (let i = 0; i < 32; i++) {
    chars.push(hex[Math.floor(rng() * 16)]);
  }
  chars[12] = '4';
  chars[16] = hex[8 + Math.floor(rng() * 4)];
  const s = chars.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Làm tròn tiền về bội số 1.000đ cho giống hóa đơn thật. */
function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function atTime(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month, day, hour, minute, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Dựng "hồ bơi" nhân sự có trọng số: ai trọng số cao thì xuất hiện nhiều lần. */
function buildWeightedPool(ids: string[], weights: number[]): string[] {
  const pool: string[] = [];
  ids.forEach((id, index) => {
    const times = weights[index % weights.length];
    for (let i = 0; i < times; i++) pool.push(id);
  });
  return pool.length > 0 ? pool : ids;
}

/** Cắt mảng thành từng lô nhỏ để `createMany` không gửi một câu lệnh quá dài. */
function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

/**
 * Dựng dữ liệu đặt phòng / hóa đơn / dịch vụ cho các năm lịch sử.
 *
 * Chỉ tạo khi năm đó chưa có dữ liệu (nhận diện qua tiền tố mã đơn `BK-YYYY-`),
 * nên gọi được cả trong seed thủ công lẫn mỗi lần app khởi động mà không nhân đôi.
 */
export async function seedHistoricalYears(
  prisma: PrismaClient,
  options: HistorySeedOptions = {},
): Promise<HistoryYearSummary[]> {
  const years = options.years?.length ? options.years : HISTORY_YEARS;
  const log = options.log ?? (() => undefined);

  const [rooms, customers, staff] = await Promise.all([
    prisma.room.findMany({
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: Role.CUSTOMER },
      select: { id: true },
      orderBy: { email: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.RECEPTIONIST] }, isActive: true },
      select: { id: true, role: true },
      orderBy: { email: 'asc' },
    }),
  ]);

  if (rooms.length === 0 || customers.length === 0 || staff.length === 0) {
    log('⚠️ Bỏ qua dữ liệu lịch sử: chưa có đủ phòng, khách hàng hoặc nhân sự.');
    return [];
  }

  const staffIds = staff.map((s) => s.id);
  const confirmPool = buildWeightedPool(staffIds, CONFIRM_WEIGHTS);
  const issuePool = buildWeightedPool(staffIds, ISSUE_WEIGHTS);
  const customerIds = customers.map((c) => c.id);

  const summaries: HistoryYearSummary[] = [];

  for (const year of years) {
    const existing = await prisma.booking.count({
      where: { bookingCode: { startsWith: `BK-${year}-` } },
    });

    if (existing > 0 && !options.force) {
      log(`   -> Năm ${year} đã có ${existing} đơn lịch sử, bỏ qua.`);
      summaries.push({
        year,
        skipped: true,
        bookings: existing,
        invoices: 0,
        serviceOrders: 0,
        revenue: 0,
      });
      continue;
    }

    if (existing > 0 && options.force) {
      // Invoice & ExtraServiceOrder có onDelete: Cascade nên xóa đơn là sạch kèm.
      await prisma.booking.deleteMany({
        where: { bookingCode: { startsWith: `BK-${year}-` } },
      });
    }

    const summary = await seedOneYear(prisma, year, {
      rooms,
      customerIds,
      confirmPool,
      issuePool,
    });

    log(
      `   -> Năm ${year}: ${summary.bookings} đơn, ${summary.invoices} hóa đơn, ` +
        `${summary.serviceOrders} dịch vụ, doanh thu ${summary.revenue.toLocaleString('vi-VN')}đ.`,
    );
    summaries.push(summary);
  }

  return summaries;
}

async function seedOneYear(
  prisma: PrismaClient,
  year: number,
  context: {
    rooms: Array<{ id: string; roomType: { basePrice: number } }>;
    customerIds: string[];
    confirmPool: string[];
    issuePool: string[];
  },
): Promise<HistoryYearSummary> {
  const { rooms, customerIds, confirmPool, issuePool } = context;
  const rng = createRng(year * 7919);
  const profile = YEAR_PROFILE[year] ?? DEFAULT_YEAR_PROFILE;
  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);

  const bookingRows: any[] = [];
  const invoiceRows: any[] = [];
  const serviceRows: any[] = [];
  let revenue = 0;
  let sequence = 0;

  // Ngày phòng được giải phóng, để đơn sau không đè lịch lên đơn trước cùng phòng.
  const roomFreeFrom = new Map<string, number>();

  for (let month = 0; month < 12; month++) {
    const totalDays = daysInMonth(year, month);
    const target = Math.max(3, Math.round(profile.baseBookings * MONTH_WEIGHTS[month]));

    // Rải ngày nhận phòng trong tháng rồi sắp xếp tăng dần để lịch phòng hợp lý.
    const checkInDays = Array.from({ length: target }, () =>
      randInt(rng, 1, totalDays - 1),
    ).sort((a, b) => a - b);

    for (const day of checkInDays) {
      const nights = Math.min(
        randInt(rng, 1, 2) === 1 ? randInt(rng, 1, 3) : randInt(rng, 3, 5),
        totalDays - day,
      );
      if (nights < 1) continue;

      const checkInDate = atTime(year, month, day, 14);
      const checkOutDate = atTime(year, month, day + nights, 12);

      // Chỉ chọn trong số phòng đang trống ở khoảng thời gian này.
      const available = rooms.filter(
        (r) => (roomFreeFrom.get(r.id) ?? 0) <= checkInDate.getTime(),
      );
      if (available.length === 0) continue;

      const room = pickRoom(rng, available);
      roomFreeFrom.set(room.id, checkOutDate.getTime());

      sequence += 1;
      const bookingId = makeId(rng);
      const bookingCode = `BK-${year}-${String(sequence).padStart(4, '0')}`;
      const customerId = pick(rng, customerIds);
      const isCancelled = rng() < 0.08;

      // Giá phòng theo mùa: tháng cao điểm nhích giá, thấp điểm giảm nhẹ.
      const seasonPrice = 1 + (MONTH_WEIGHTS[month] - 1) * 0.25;
      const nightly = room.roomType.basePrice * profile.priceFactor * seasonPrice;
      const roomAmount = roundToThousand(nightly * nights);

      const bookedAt = addDays(checkInDate, -randInt(rng, 5, 45));
      let confirmedAt = addDays(checkInDate, -randInt(rng, 1, 4));
      if (confirmedAt < yearStart) confirmedAt = new Date(yearStart.getTime() + 9 * 3600 * 1000);

      if (isCancelled) {
        // Đơn hủy: có dấu vết người hủy để lên cột "đơn đã hủy" của báo cáo A1.
        const cancelledByStaff = rng() < 0.6;
        let cancelledAt = addDays(checkInDate, -randInt(rng, 1, 3));
        if (cancelledAt < yearStart) cancelledAt = new Date(yearStart.getTime() + 9 * 3600 * 1000);

        bookingRows.push({
          id: bookingId,
          bookingCode,
          customerId,
          roomId: room.id,
          checkInDate,
          checkOutDate,
          guestCount: randInt(rng, 1, 3),
          totalAmount: roomAmount,
          depositAmount: 0,
          status: BookingStatus.CANCELLED,
          specialRequests: pick(rng, SPECIAL_REQUESTS),
          cancellationReason: pick(rng, CANCEL_REASONS),
          cancelledAt,
          cancelledById: cancelledByStaff ? pick(rng, confirmPool) : customerId,
          createdAt: bookedAt,
        });
        continue;
      }

      // Dịch vụ phát sinh trong kỳ lưu trú
      const serviceCount = randInt(rng, 0, 3);
      let servicesAmount = 0;
      const usedServices = new Set<string>();
      for (let i = 0; i < serviceCount; i++) {
        const svc = pick(rng, SERVICE_CATALOG);
        if (usedServices.has(svc.serviceName)) continue;
        usedServices.add(svc.serviceName);

        const quantity = randInt(rng, 1, svc.maxQty);
        const totalPrice = svc.unitPrice * quantity;
        servicesAmount += totalPrice;
        serviceRows.push({
          id: makeId(rng),
          bookingId,
          serviceName: svc.serviceName,
          unitPrice: svc.unitPrice,
          quantity,
          totalPrice,
          status: 'CONFIRMED',
          createdAt: addDays(checkInDate, randInt(rng, 0, Math.max(0, nights - 1))),
        });
      }

      const discount = rng() < 0.15 ? roundToThousand(roomAmount * 0.05) : 0;
      const taxable = roomAmount + servicesAmount - discount;
      const tax = roundToThousand(taxable * 0.1);
      const finalAmount = taxable + tax;

      // 90% hóa đơn thu đủ, 10% mới thu một phần (vẫn tính vào doanh thu thực thu).
      const isFullyPaid = rng() < 0.9;
      const paidAmount = isFullyPaid
        ? finalAmount
        : roundToThousand(finalAmount * (0.5 + rng() * 0.3));

      bookingRows.push({
        id: bookingId,
        bookingCode,
        customerId,
        roomId: room.id,
        checkInDate,
        checkOutDate,
        actualCheckIn: atTime(year, month, day, randInt(rng, 14, 20), randInt(rng, 0, 59)),
        actualCheckOut: atTime(year, month, day + nights, randInt(rng, 9, 12), randInt(rng, 0, 59)),
        guestCount: randInt(rng, 1, 4),
        totalAmount: roomAmount,
        depositAmount: roundToThousand(roomAmount * (0.3 + rng() * 0.2)),
        status: BookingStatus.CHECKED_OUT,
        specialRequests: pick(rng, SPECIAL_REQUESTS),
        confirmedAt,
        confirmedById: pick(rng, confirmPool),
        confirmationNote: 'Đơn đã xác nhận và thu cọc giữ phòng',
        createdAt: bookedAt,
      });

      invoiceRows.push({
        id: makeId(rng),
        invoiceCode: `INV-${year}-${String(sequence).padStart(4, '0')}`,
        bookingId,
        roomAmount,
        servicesAmount,
        discount,
        tax,
        finalAmount,
        paidAmount,
        paymentMethod: pick(rng, PAYMENT_METHOD_POOL),
        paymentStatus: isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
        issuedById: pick(rng, issuePool),
        // Hóa đơn chốt tại quầy khi khách trả phòng -> ngày phát hành = ngày thu tiền.
        paidAt: checkOutDate,
        createdAt: checkOutDate,
        notes: isFullyPaid
          ? 'Khách thanh toán đủ khi trả phòng'
          : 'Khách thanh toán một phần, phần còn lại công ty chuyển khoản sau',
      });

      revenue += paidAmount;
    }
  }

  // Ghi cả năm trong MỘT transaction: rớt mạng giữa chừng thì không để lại
  // đơn không hóa đơn (báo cáo sẽ lệch) và lần chạy sau vẫn dựng lại được.
  // Thứ tự bắt buộc: booking -> invoice/service vì hai bảng sau tham chiếu bookingId.
  await prisma.$transaction([
    ...chunk(bookingRows, 100).map((rows) =>
      prisma.booking.createMany({ data: rows, skipDuplicates: true }),
    ),
    ...chunk(invoiceRows, 100).map((rows) =>
      prisma.invoice.createMany({ data: rows, skipDuplicates: true }),
    ),
    ...chunk(serviceRows, 100).map((rows) =>
      prisma.extraServiceOrder.createMany({ data: rows, skipDuplicates: true }),
    ),
  ]);

  return {
    year,
    skipped: false,
    bookings: bookingRows.length,
    invoices: invoiceRows.length,
    serviceOrders: serviceRows.length,
    revenue,
  };
}
