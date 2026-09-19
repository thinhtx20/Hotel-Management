import { BookingStatus, RoomStatus } from '@prisma/client';

/**
 * Các trạng thái phòng do con người đặt tay hoặc quy trình buồng phòng vận hành,
 * không được tự động suy diễn đè từ lịch đặt phòng:
 * - CLEANING: Khách vừa trả phòng hoặc nhân viên đang dọn dẹp vệ sinh phòng.
 *   Phải đợi buồng phòng xác nhận dọn xong (chuyển sang AVAILABLE) thì phòng
 *   mới sẵn sàng đón lượt khách tiếp theo. Tuyệt đối không tự động nhảy sang
 *   RESERVED hay AVAILABLE dù ngày hôm nay có đơn đặt phòng CONFIRMED kế tiếp.
 * - MAINTENANCE: Phòng đang sửa chữa, bảo trì kỹ thuật.
 * - PENDING_APPROVAL: Phòng mới tạo chưa được duyệt.
 * - REJECTED: Phòng bị từ chối duyệt.
 */
export const MANUAL_ROOM_STATUSES: RoomStatus[] = [
  RoomStatus.CLEANING,
  RoomStatus.MAINTENANCE,
  RoomStatus.PENDING_APPROVAL,
  RoomStatus.REJECTED,
];

export interface RoomStatusBookingInput {
  status: BookingStatus;
  checkInDate?: Date;
  checkOutDate: Date;
}

/**
 * Nguồn sự thật duy nhất cho trạng thái phòng suy ra từ lịch đặt phòng.
 *
 *  - Đang có khách CHECKED_IN (chưa trả phòng và thanh toán) -> luôn là OCCUPIED
 *  - Các trạng thái thủ công / buồng phòng (CLEANING, MAINTENANCE, PENDING_APPROVAL, REJECTED) -> giữ nguyên
 *  - Có đơn CONFIRMED giữ phòng cho ngày hôm nay (chưa qua ngày trả) -> RESERVED
 *  - Không có đơn nào đang giữ phòng hôm nay -> AVAILABLE
 *
 * Đơn PENDING KHÔNG chiếm phòng: khách mới gửi yêu cầu, lễ tân chưa xác nhận.
 */
export function deriveRoomStatus(
  currentStatus: RoomStatus,
  bookings: RoomStatusBookingInput[],
  now: Date = new Date(),
): RoomStatus {
  // 1. Đang có khách CHECKED_IN (chưa trả phòng và thanh toán) -> luôn là OCCUPIED
  if (bookings.some((b) => b.status === BookingStatus.CHECKED_IN)) {
    return RoomStatus.OCCUPIED;
  }

  // 2. Các trạng thái thủ công / buồng phòng được bảo toàn, không bị lịch đặt phòng ghi đè
  if (MANUAL_ROOM_STATUSES.includes(currentStatus)) {
    return currentStatus;
  }

  // Cuối ngày hôm nay để xét đơn đặt phòng có hiệu lực cho ngày hôm nay
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // 3. Có đơn CONFIRMED đang giữ phòng cho hôm nay:
  // Đã hoặc sẽ nhận phòng trước cuối ngày hôm nay, và chưa tới giờ trả phòng.
  if (
    bookings.some((b) => {
      if (b.status !== BookingStatus.CONFIRMED) return false;
      const checkOut = new Date(b.checkOutDate);
      if (checkOut <= now) return false;
      if (b.checkInDate) {
        const checkIn = new Date(b.checkInDate);
        return checkIn <= endOfToday;
      }
      return true;
    })
  ) {
    return RoomStatus.RESERVED;
  }

  return RoomStatus.AVAILABLE;
}
