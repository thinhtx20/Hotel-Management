import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * CHÍNH SÁCH "MỖI TÀI KHOẢN CHỈ ĐĂNG NHẬP TRÊN 1 THIẾT BỊ"
 *
 * Cách hoạt động:
 * - Mỗi lần đăng nhập thành công, server sinh một mã phiên (`sessionId`) và lưu vào
 *   cột `users.activeSessionId`. Mã này được nhúng vào JWT dưới tên `sid`.
 * - Mọi request đều đi qua `JwtStrategy`, nơi `sid` trong token được đối chiếu với
 *   `activeSessionId` trong CSDL. Lệch nhau nghĩa là token thuộc thiết bị cũ -> 401.
 * - Nhờ chốt ở CSDL (không phải Redis), ràng buộc vẫn đúng khi Redis chưa khởi động.
 *
 * Phạm vi áp dụng: chỉ tài khoản khách hàng. Nhân viên (lễ tân) và quản trị viên
 * thường phải trực nhiều máy tại quầy nên không bị giới hạn.
 */
export const SINGLE_DEVICE_ROLES: Role[] = [Role.CUSTOMER];

export function isSingleDeviceRole(role: Role | string | undefined | null): boolean {
  return !!role && SINGLE_DEVICE_ROLES.includes(role as Role);
}

/**
 * `kick_old` (mặc định): đăng nhập ở máy mới sẽ đá phiên ở máy cũ ra.
 * `block_new`: giữ phiên máy cũ, từ chối đăng nhập ở máy mới cho tới khi máy cũ đăng xuất
 *              (hoặc tới khi phiên cũ hết hạn theo JWT_REFRESH_EXPIRES_IN).
 */
export type SingleDeviceMode = 'kick_old' | 'block_new';

export function getSingleDeviceMode(): SingleDeviceMode {
  return (process.env.SINGLE_DEVICE_MODE || '').trim().toLowerCase() === 'block_new'
    ? 'block_new'
    : 'kick_old';
}

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
}

/**
 * Rút gọn User-Agent thành nhãn dễ đọc để hiển thị cho người dùng cuối,
 * ví dụ: "Chrome trên Windows (IP 14.161.20.7)".
 */
export function describeDevice(device?: DeviceInfo): string {
  const ua = (device?.userAgent || '').trim();
  const ipSuffix = device?.ip ? ` (IP ${device.ip})` : '';

  if (!ua) {
    return `Thiết bị không xác định${ipSuffix}`;
  }

  const browser = /edg\//i.test(ua)
    ? 'Microsoft Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /chrome|crios/i.test(ua)
        ? 'Chrome'
        : /firefox|fxios/i.test(ua)
          ? 'Firefox'
          : /safari/i.test(ua)
            ? 'Safari'
            : /postman/i.test(ua)
              ? 'Postman'
              : /okhttp|dart|flutter/i.test(ua)
                ? 'Ứng dụng di động'
                : 'Ứng dụng khác';

  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod|ios/i.test(ua)
      ? 'iOS'
      : /windows/i.test(ua)
        ? 'Windows'
        : /mac os|macintosh/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'hệ điều hành không rõ';

  return `${browser} trên ${os}${ipSuffix}`;
}

/**
 * Lỗi 401 khi token đến từ thiết bị đã bị thay thế bởi lần đăng nhập mới.
 * FE bắt theo `error === 'SESSION_REVOKED'` để tự xóa token và đưa về màn đăng nhập.
 */
export function sessionRevokedException(activeDevice?: string | null): UnauthorizedException {
  const where = activeDevice ? ` (${activeDevice})` : '';
  return new UnauthorizedException({
    error: 'SESSION_REVOKED',
    message:
      `Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác${where}. ` +
      `Phiên làm việc trên thiết bị này đã kết thúc, vui lòng đăng nhập lại.`,
  });
}

/**
 * Lỗi 401 ở chế độ `block_new`: máy cũ vẫn đang giữ phiên nên máy mới không được vào.
 */
export function deviceLimitException(activeDevice?: string | null): UnauthorizedException {
  const where = activeDevice ? ` (${activeDevice})` : '';
  return new UnauthorizedException({
    error: 'SESSION_DEVICE_LIMIT',
    message:
      `Tài khoản này đang đăng nhập trên một thiết bị khác${where}. ` +
      `Mỗi tài khoản khách hàng chỉ được đăng nhập trên 1 thiết bị, ` +
      `vui lòng đăng xuất ở thiết bị đó rồi thử lại.`,
  });
}
