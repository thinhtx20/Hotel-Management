import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Role } from '@prisma/client';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: string; // 'booking' | 'payment' | 'service' | 'promotion' | 'system'
  actionRoute?: string;
  actionLabel?: string;
}

export interface AppNotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  isRead: boolean;
  data?: Record<string, any>;
  actionRoute?: string;
  actionLabel?: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: App | null = null;
  private readonly inMemoryNotifications = new Map<string, AppNotificationItem[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      const currentApps = getApps();
      if (currentApps.length > 0) {
        this.firebaseApp = currentApps[0]!;
        this.logger.log('🔔 Firebase Admin SDK đã được khởi tạo trước đó.');
        return;
      }

      const possiblePaths = [
        path.join(__dirname, '../testmoi-1bb55-firebase-adminsdk-p24b5-c933949aed.json'),
        path.join(process.cwd(), 'src/testmoi-1bb55-firebase-adminsdk-p24b5-c933949aed.json'),
        path.join(process.cwd(), 'dist/src/testmoi-1bb55-firebase-adminsdk-p24b5-c933949aed.json'),
        path.join(process.cwd(), 'testmoi-1bb55-firebase-adminsdk-p24b5-c933949aed.json'),
      ];

      let keyPath = possiblePaths.find((p) => fs.existsSync(p));

      if (!keyPath) {
        const srcDir = path.join(process.cwd(), 'src');
        if (fs.existsSync(srcDir)) {
          const files = fs.readdirSync(srcDir);
          const found = files.find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
          if (found) {
            keyPath = path.join(srcDir, found);
          }
        }
      }

      if (keyPath && fs.existsSync(keyPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        this.firebaseApp = initializeApp({
          credential: cert(serviceAccount),
        });
        this.logger.log(`✅ Khởi tạo Firebase Admin SDK thành công từ: ${keyPath}`);
      } else {
        this.logger.warn('⚠️ Không tìm thấy file Firebase Service Account JSON, push notification sẽ bị vô hiệu hóa.');
      }
    } catch (error: any) {
      this.logger.error(`❌ Lỗi khởi tạo Firebase Admin SDK: ${error.message}`, error.stack);
    }
  }

  /**
   * Lưu thông báo vào danh sách của user (In-Memory + Redis cache)
   */
  private async storeNotification(userId: string, item: AppNotificationItem) {
    const list = this.inMemoryNotifications.get(userId) || [];
    list.unshift(item);
    if (list.length > 50) list.pop();
    this.inMemoryNotifications.set(userId, list);

    try {
      const cacheKey = `user:${userId}:notifications`;
      await this.redis.set(cacheKey, list, 86400 * 7);
    } catch (_) {}
  }

  /**
   * Gửi thông báo tới một người dùng cụ thể:
   * 1. Lưu vào danh sách thông báo của người dùng
   * 2. Nếu người dùng có fcmToken -> Gửi Push Notification qua Firebase FCM
   */
  async sendToUser(userId: string, payload: NotificationPayload): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, fcmToken: true },
    });

    const notifItem: AppNotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: payload.title,
      body: payload.body,
      category: payload.category || 'booking',
      createdAt: new Date().toISOString(),
      isRead: false,
      data: payload.data,
      actionRoute: payload.actionRoute || payload.data?.route || '/my-bookings',
      actionLabel: payload.actionLabel || payload.data?.actionLabel || 'Xem chi tiết',
    };

    await this.storeNotification(userId, notifItem);

    if (user && user.fcmToken) {
      // Gửi push notification qua Firebase FCM ở chế độ bất đồng bộ (non-blocking)
      // giúp API phản hồi tức thì mà không phải chờ mạng Google Firebase
      setImmediate(() => {
        this.sendToToken(user.fcmToken!, payload).catch((err) => {
          this.logger.warn(`Lỗi gửi FCM background cho user ${userId}: ${err.message}`);
        });
      });
    }

    return true;
  }

  /**
   * Gửi thông báo đẩy FCM trực tiếp tới một FCM Device Token với cấu hình Modern Luxury
   */
  async sendToToken(fcmToken: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.firebaseApp) {
      this.logger.warn('⚠️ Firebase Admin SDK chưa sẵn sàng, bỏ qua gửi FCM push.');
      return false;
    }

    try {
      const response = await getMessaging(this.firebaseApp).send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          category: payload.category ?? 'Thông báo khách sạn',
          route: payload.actionRoute ?? payload.data?.route ?? '/my-bookings',
          actionRoute: payload.actionRoute ?? payload.data?.route ?? '/my-bookings',
          actionLabel: payload.actionLabel ?? 'Xem chi tiết',
          ...(payload.data ?? {}),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'hotel_reminder_channel',
            icon: 'ic_notification',
            color: '#D97706',
            sound: 'default',
            defaultVibrateTimings: true,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
      });

      this.logger.log(`🚀 [FCM] Đã gửi thông báo thành công tới token ${fcmToken.slice(0, 15)}... (ID: ${response})`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ [FCM] Gửi thông báo thất bại: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Lấy danh sách thông báo của người dùng
   */
  async getUserNotifications(userId: string): Promise<{ data: AppNotificationItem[]; unreadCount: number }> {
    let items = this.inMemoryNotifications.get(userId) || [];

    if (items.length === 0) {
      try {
        const cached = await this.redis.get<AppNotificationItem[]>(`user:${userId}:notifications`);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          items = cached;
          this.inMemoryNotifications.set(userId, items);
        }
      } catch (_) {}
    }

    // Chỉ sinh từ DB khi hoàn toàn chưa có thông báo nào trong cache
    if (items.length === 0) {
      const dbNotifications = await this.generateNotificationsFromDb(userId);
      items = dbNotifications;
      this.inMemoryNotifications.set(userId, items);
      try {
        await this.redis.set(`user:${userId}:notifications`, items, 86400 * 7);
      } catch (_) {}
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = items.filter((i) => !i.isRead).length;
    return { data: items, unreadCount };
  }

  private async generateNotificationsFromDb(userId: string): Promise<AppNotificationItem[]> {
    const list: AppNotificationItem[] = [];

    try {
      const bookings = await this.prisma.booking.findMany({
        where: { customerId: userId },
        include: { room: { select: { roomNumber: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });

      for (const b of bookings) {
        const roomNum = b.room?.roomNumber ? `Phòng ${b.room.roomNumber}` : 'phòng';
        if (b.status === 'CHECKED_IN') {
          list.push({
            id: `booking_ci_${b.id}`,
            userId,
            title: `Nhận phòng thành công • ${roomNum}`,
            body: `Chào mừng Quý khách đến với Luxe Grand Hotel! Thẻ khóa và dịch vụ ${roomNum} đã sẵn sàng.`,
            category: 'booking',
            createdAt: (b.actualCheckIn || b.updatedAt).toISOString(),
            isRead: false,
            actionRoute: '/my-bookings',
            actionLabel: 'Xem chuyến đi',
          });
        } else if (b.status === 'CHECKED_OUT') {
          list.push({
            id: `booking_co_${b.id}`,
            userId,
            title: `Trả phòng thành công • ${roomNum}`,
            body: `Cảm ơn Quý khách đã nghỉ dưỡng tại ${roomNum}. Hẹn gặp lại Quý khách tại Luxe Grand Hotel!`,
            category: 'booking',
            createdAt: (b.actualCheckOut || b.updatedAt).toISOString(),
            isRead: true,
            actionRoute: '/my-bookings',
            actionLabel: 'Chi tiết đơn',
          });
        } else if (b.status === 'CONFIRMED') {
          list.push({
            id: `booking_cf_${b.id}`,
            userId,
            title: `Đơn đặt phòng đã duyệt • ${b.bookingCode}`,
            body: `Đơn đặt phòng ${b.bookingCode} (${roomNum}) của Quý khách đã được xác nhận.`,
            category: 'booking',
            createdAt: (b.confirmedAt || b.updatedAt).toISOString(),
            isRead: false,
            actionRoute: '/my-bookings',
            actionLabel: 'Xem chuyến đi',
          });
        } else if (b.status === 'PENDING') {
          list.push({
            id: `booking_pd_${b.id}`,
            userId,
            title: `Đơn đặt phòng đang chờ duyệt • ${b.bookingCode}`,
            body: `Đơn đặt phòng ${b.bookingCode} đã được tiếp nhận và đang đợi Lễ tân xác nhận.`,
            category: 'booking',
            createdAt: b.createdAt.toISOString(),
            isRead: false,
            actionRoute: '/my-bookings',
            actionLabel: 'Xem chuyến đi',
          });
        }
      }

      const invoices = await this.prisma.invoice.findMany({
        where: { booking: { customerId: userId } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      });

      for (const inv of invoices) {
        if (inv.paymentStatus === 'PAID') {
          list.push({
            id: `inv_paid_${inv.id}`,
            userId,
            title: `Thanh toán thành công • ${inv.invoiceCode}`,
            body: `Hóa đơn ${inv.invoiceCode} trị giá ${Number(inv.finalAmount).toLocaleString('vi-VN')}đ đã được thanh toán đầy đủ.`,
            category: 'payment',
            createdAt: inv.updatedAt.toISOString(),
            isRead: true,
            actionRoute: '/my-bookings',
            actionLabel: 'Xem hóa đơn',
          });
        } else if (inv.paymentStatus === 'UNPAID') {
          list.push({
            id: `inv_unpaid_${inv.id}`,
            userId,
            title: `Hóa đơn mới phát sinh • ${inv.invoiceCode}`,
            body: `Hóa đơn dịch vụ ${inv.invoiceCode} trị giá ${Number(inv.finalAmount).toLocaleString('vi-VN')}đ đã được cập nhật.`,
            category: 'payment',
            createdAt: inv.createdAt.toISOString(),
            isRead: false,
            actionRoute: '/my-bookings',
            actionLabel: 'Thanh toán ngay',
          });
        }
      }

      list.push({
        id: `promo_vip_${userId}`,
        userId,
        title: 'Ưu đãi Đặc quyền Thành viên VIP',
        body: 'Tặng Quý khách Voucher giảm 20% khi trải nghiệm ẩm thực Hoàng Gia tại Rooftop Paradise.',
        category: 'promotion',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        isRead: false,
        actionRoute: '/services',
        actionLabel: 'Nhận ưu đãi',
      });

      list.push({
        id: `sys_welcome_${userId}`,
        userId,
        title: 'Chào mừng Quý khách đến với Paradise Resort',
        body: 'Chúc Quý khách một kỳ nghỉ thượng lưu, tiện nghi và trọn vẹn tại khách sạn.',
        category: 'system',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        isRead: true,
      });
    } catch (error: any) {
      this.logger.error(`Lỗi generateNotificationsFromDb: ${error.message}`);
    }

    return list;
  }

  async markAsRead(userId: string, notifId: string): Promise<boolean> {
    const list = this.inMemoryNotifications.get(userId) || [];
    const item = list.find((i) => i.id === notifId);
    if (item) {
      item.isRead = true;
      try {
        await this.redis.set(`user:${userId}:notifications`, list, 86400 * 7);
      } catch (_) {}
      return true;
    }
    return false;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const list = this.inMemoryNotifications.get(userId) || [];
    for (const item of list) {
      item.isRead = true;
    }
    try {
      await this.redis.set(`user:${userId}:notifications`, list, 86400 * 7);
    } catch (_) {}
    return true;
  }

  async sendTestNotification(userId: string, title?: string, body?: string, category?: string): Promise<{ success: boolean; message: string }> {
    const defaultTitle = title || 'Nhắc nhở thời gian trả phòng • Phòng 302';
    const defaultBody = body || 'Phòng Deluxe 302 của Quý khách có giờ trả phòng dự kiến lúc 12:00 hôm nay. Quý khách vui lòng kiểm tra hành lý.';
    const defaultCategory = category || 'booking';

    const sent = await this.sendToUser(userId, {
      title: defaultTitle,
      body: defaultBody,
      category: defaultCategory,
      data: {
        type: 'TEST_NOTIFICATION',
        route: '/my-bookings',
      },
    });

    return {
      success: true,
      message: sent
        ? 'Đã gửi thông báo In-App và Push Notification thành công!'
        : 'Đã lưu thông báo In-App (thiết bị chưa đăng ký FCM token).',
    };
  }

  async broadcast(payload: NotificationPayload, targetRole?: Role): Promise<{ sentCount: number; totalUsers: number }> {
    const users = await this.prisma.user.findMany({
      where: targetRole ? { role: targetRole } : {},
      select: { id: true, fcmToken: true },
    });

    // Gửi song song thay vì lặp tuần tự từng user
    let sentCount = 0;
    await Promise.all(
      users.map(async (user) => {
        const ok = await this.sendToUser(user.id, payload);
        if (ok) sentCount++;
      }),
    );

    return { sentCount, totalUsers: users.length };
  }
}
