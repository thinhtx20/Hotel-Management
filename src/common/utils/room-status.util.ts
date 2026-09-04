import { BookingStatus, RoomStatus } from '@prisma/client';

/**
 * Các trạng thái phòng do con người đặt tay, không được suy ra từ lịch đặt phòng.
 * Lễ tân phải tự chuyển phòng ra khỏi các trạng thái này.
 */
export const MANUAL_ROOM_STATUSES: RoomStatus[] = [
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
 *  - Đang có khách CHECKED_IN và chưa hết hạn trả phòng -> OCCUPIED
 *  - Có đơn CONFIRMED giữ phòng cho ngày hôm nay (chưa qua ngày trả) -> RESERVED
 *  - Không có đơn nào đang giữ phòng hôm nay -> giữ CLEANING nếu đang dọn, ngược lại AVAILABLE
 *
 * Đơn PENDING KHÔNG chiếm phòng: khách mới gửi yêu cầu, lễ tân chưa xác nhận.
 */
export function deriveRoomStatus(
  currentStatus: RoomStatus,
  bookings: RoomStatusBookingInput[],
  now: Date = new Date(),
): RoomStatus {
  if (MANUAL_ROOM_STATUSES.includes(currentStatus)) {
    return currentStatus;
  }

  // 1. Đang có khách CHECKED_IN và chưa qua giờ trả phòng
  if (
    bookings.some(
      (b) =>
        b.status === BookingStatus.CHECKED_IN &&
        new Date(b.checkOutDate) > now,
    )
  ) {
    return RoomStatus.OCCUPIED;
  }

  // Cuối ngày hôm nay để xét đơn đặt phòng có hiệu lực cho ngày hôm nay
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // 2. Có đơn CONFIRMED đang giữ phòng cho hôm nay:
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

  // 3. Phòng vừa trả và đang dọn dẹp vẫn phải chờ buồng phòng xác nhận xong.
  if (currentStatus === RoomStatus.CLEANING) {
    return RoomStatus.CLEANING;
  }

  return RoomStatus.AVAILABLE;
}
