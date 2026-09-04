import { PaymentStatus } from '@prisma/client';

/**
 * Các khoảng thời gian chuẩn của báo cáo doanh thu theo ngày.
 * FE dựng 4 chip lọc "Hôm nay / 7 ngày / 14 ngày / 30 ngày" đúng theo danh sách này.
 */
export const REVENUE_RANGES = [1, 7, 14, 30];

export const DEFAULT_REVENUE_RANGE = 7;

/**
 * Quy tắc doanh thu dùng chung cho mọi endpoint tiền bạc (BE-5, BE-6):
 *
 * - Doanh thu là **tiền thực thu** (`paidAmount`), không phải tiền xuất hóa đơn (`finalAmount`).
 * - Ghi nhận theo **ngày thanh toán** (`paidAt`), không phải ngày tạo hóa đơn.
 * - Tính cả hóa đơn `PARTIAL` vì tiền đã vào két; loại `UNPAID` và `REFUNDED`.
 *
 * Trước đây mỗi endpoint tự lọc một kiểu nên `/analytics/dashboard`,
 * `/analytics/revenue/daily` và `/invoices/summary` trả ba con số khác nhau
 * cho cùng một ngày. Mọi nơi phải dùng chung helper này.
 */
export const COLLECTED_PAYMENT_STATUSES = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIAL,
];

export function collectedRevenueWhere(start: Date, end: Date) {
  return {
    paidAt: { gte: start, lte: end },
    paymentStatus: { in: COLLECTED_PAYMENT_STATUSES },
  };
}

/** Tiền VND không có phần lẻ — chốt lại để tránh sai số cộng dồn kiểu Float. */
export function roundMoney(value: number): number {
  return Math.round(value || 0);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * `YYYY-MM-DD` theo giờ máy chủ (TZ=Asia/Ho_Chi_Minh).
 * Không dùng `toISOString()` vì nó quy về UTC và làm lệch ngày 7 tiếng.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Một điểm trên biểu đồ doanh thu theo ngày. */
export interface DailyRevenuePoint {
  date: string;
  label: string;
  dateLabel: string;
  revenue: number;
  /** Alias của `revenue` cho FE đang đọc field `amount`. */
  amount: number;
  invoiceCount: number;
}

export interface DayBucket {
  date: string;
  label: string;
  dateLabel: string;
  start: Date;
  end: Date;
}

/** `numDays` ô ngày liên tiếp tính đến hôm nay, sắp xếp từ cũ đến mới. */
export function buildDayBuckets(numDays: number): DayBucket[] {
  const buckets: DayBucket[] = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const start = startOfDay(d);

    buckets.push({
      date: formatLocalDate(start),
      label: WEEKDAY_LABELS[start.getDay()],
      dateLabel: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`,
      start,
      end: endOfDay(d),
    });
  }

  return buckets;
}

/**
 * Chuẩn hóa tham số `?days=` / `?range=`.
 * Giá trị rỗng hoặc không hợp lệ trả về khoảng mặc định 7 ngày; ngoài 4 khoảng
 * chuẩn vẫn chấp nhận số ngày tùy ý (1..90) để không phá các client đang chạy.
 */
export function normalizeRevenueRange(value?: number): number {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) {
    return DEFAULT_REVENUE_RANGE;
  }
  const days = Math.trunc(Number(value));
  if (days < 1) {
    return DEFAULT_REVENUE_RANGE;
  }
  return Math.min(days, 90);
}
