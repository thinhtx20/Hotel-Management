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
  checkOutDate: Date;
}

/**
 * Nguồn sự thật duy nhất cho trạng thái phòng suy ra từ lịch đặt phòng.
 *
 *  - Đang có khách CHECKED_IN            -> OCCUPIED
 *  - Có đơn CONFIRMED chưa tới ngày trả  -> RESERVED
 *  - Không có đơn nào đang giữ phòng     -> giữ CLEANING nếu đang dọn, ngược lại AVAILABLE
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

  if (bookings.some((b) => b.status === BookingStatus.CHECKED_IN)) {
    return RoomStatus.OCCUPIED;
  }

  if (
    bookings.some(
      (b) => b.status === BookingStatus.CONFIRMED && new Date(b.checkOutDate) > now,
    )
  ) {
    return RoomStatus.RESERVED;
  }

  // Phòng vừa trả và đang dọn dẹp vẫn phải chờ buồng phòng xác nhận xong.
  if (currentStatus === RoomStatus.CLEANING) {
    return RoomStatus.CLEANING;
  }

  return RoomStatus.AVAILABLE;
}
