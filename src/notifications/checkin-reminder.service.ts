import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from './notifications.service';

/**
 * Cron Job: Nhắc nhở khách hàng sắp đến ngày nhận phòng
 *
 * - Chạy mỗi ngày lúc 08:00 sáng (GMT+7 = 01:00 UTC)
 * - Quét các booking có trạng thái CONFIRMED với checkInDate trong ngày hôm nay hoặc ngày mai
 * - Gửi push notification + in-app notification tới khách hàng
 * - Dùng Redis key để đảm bảo không gửi trùng lặp
 */
@Injectable()
export class CheckinReminderService {
  private readonly logger = new Logger(CheckinReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Cron chạy lúc 08:00 sáng hàng ngày (giờ GMT+7 = 01:00 UTC)
   * Quét booking CONFIRMED sắp đến ngày nhận phòng (hôm nay & ngày mai)
   */
  @Cron('0 1 * * *', { name: 'checkin-reminder', timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCheckinReminder() {
    this.logger.log('🔔 [Cron] Bắt đầu quét booking sắp đến ngày nhận phòng...');

    try {
      const now = new Date();

      // ── Mốc "hôm nay" (00:00 → 23:59:59 theo UTC) ──
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);

      const todayEnd = new Date(now);
      todayEnd.setUTCHours(23, 59, 59, 999);

      // ── Mốc "ngày mai" (00:00 → 23:59:59 theo UTC) ──
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

      const tomorrowEnd = new Date(todayEnd);
      tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 1);

      // ── Query booking CONFIRMED có checkInDate hôm nay hoặc ngày mai ──
      const upcomingBookings = await this.prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          checkInDate: {
            gte: todayStart,
            lte: tomorrowEnd,
          },
        },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          room: {
            select: {
              roomNumber: true,
              floor: true,
              roomType: { select: { name: true } },
            },
          },
        },
      });

      if (upcomingBookings.length === 0) {
        this.logger.log('✅ [Cron] Không có booking nào sắp đến ngày nhận phòng.');
        return;
      }

      this.logger.log(`📋 [Cron] Tìm thấy ${upcomingBookings.length} booking sắp nhận phòng.`);

      let sentCount = 0;

      for (const booking of upcomingBookings) {
        // ── Kiểm tra đã gửi nhắc nhở chưa (tránh trùng lặp) ──
        const redisKey = `checkin-reminder:${booking.id}`;
        const alreadySent = await this.redis.get<string>(redisKey);
        if (alreadySent) {
          this.logger.debug(`⏩ Đã gửi nhắc nhở cho booking ${booking.bookingCode}, bỏ qua.`);
          continue;
        }

        // ── Xác định nhận phòng hôm nay hay ngày mai ──
        const checkInDate = new Date(booking.checkInDate);
        const isToday = checkInDate >= todayStart && checkInDate <= todayEnd;
        const isTomorrow = checkInDate >= tomorrowStart && checkInDate <= tomorrowEnd;

        const roomNum = booking.room?.roomNumber ? `Phòng ${booking.room.roomNumber}` : 'phòng';
        const roomType = booking.room?.roomType?.name || '';
        const floor = booking.room?.floor ? `Tầng ${booking.room.floor}` : '';
        const guestName = booking.customer?.fullName || 'Quý khách';

        const checkInDateStr = checkInDate.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        let title: string;
        let body: string;

        if (isToday) {
          // ── Nhận phòng HÔM NAY ──
          title = `🏨 Nhận phòng hôm nay • ${roomNum}`;
          body =
            `Kính chào ${guestName}, hôm nay là ngày nhận phòng của Quý khách! ` +
            `${roomType ? roomType + ' — ' : ''}${roomNum}${floor ? ' (' + floor + ')' : ''} đã sẵn sàng. ` +
            `Giờ nhận phòng tiêu chuẩn: 14:00. Mã đặt phòng: ${booking.bookingCode}.`;
        } else if (isTomorrow) {
          // ── Nhận phòng NGÀY MAI ──
          title = `📅 Nhắc nhở: Nhận phòng ngày mai • ${roomNum}`;
          body =
            `Kính chào ${guestName}, ngày mai (${checkInDateStr}) Quý khách sẽ nhận phòng tại khách sạn. ` +
            `${roomType ? roomType + ' — ' : ''}${roomNum}${floor ? ' (' + floor + ')' : ''}. ` +
            `Giờ nhận phòng: từ 14:00. Mã đặt phòng: ${booking.bookingCode}. ` +
            `Quý khách vui lòng chuẩn bị giấy tờ tùy thân khi đến làm thủ tục.`;
        } else {
          continue;
        }

        // ── Gửi thông báo cho khách hàng ──
        await this.notifications.sendToUser(booking.customerId, {
          title,
          body,
          category: 'booking',
          data: {
            type: 'CHECKIN_REMINDER',
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            roomNumber: booking.room?.roomNumber || '',
            checkInDate: booking.checkInDate.toISOString(),
            route: '/my-bookings',
          },
          actionRoute: '/my-bookings',
          actionLabel: 'Xem đặt phòng',
        });

        // ── Đánh dấu đã gửi, TTL 48 giờ (tránh gửi lại) ──
        await this.redis.set(redisKey, 'sent', 48 * 3600);
        sentCount++;

        this.logger.log(
          `✅ Đã gửi nhắc nhở nhận phòng cho ${guestName} (${booking.bookingCode}) — ${isToday ? 'Hôm nay' : 'Ngày mai'}`,
        );
      }

      this.logger.log(`🔔 [Cron] Hoàn tất: Đã gửi ${sentCount}/${upcomingBookings.length} thông báo nhắc nhở nhận phòng.`);
    } catch (error: any) {
      this.logger.error(`❌ [Cron] Lỗi khi quét nhắc nhở nhận phòng: ${error.message}`, error.stack);
    }
  }
}
