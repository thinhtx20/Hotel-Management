import { Room, RoomType, RoomStatus, BookingStatus } from '@prisma/client';

export interface RoomCurrentBooking {
  id: string;
  bookingCode: string;
  guestName: string;
  guestPhone: string | null;
  checkOutDate: Date;
}

export interface RoomResponse {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  notes?: string | null;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  description: string | null;
  pricePerNight: number;
  images: string[];
  amenities: string[];
  capacityAdults: number;
  capacityChildren: number;
  capacity: number;
  sizeSqM: number | null;
  area: number;
  rating: number;
  reviewCount: number;
  currentBooking?: RoomCurrentBooking | null;
  bookings?: any[];
}

/**
 * Mapper chuẩn hóa dữ liệu phòng (BE-3, BE-10 & Claude Artifact Section 04)
 * Phẳng hóa thông tin từ roomType để FE sử dụng trực tiếp: images, amenities, pricePerNight, capacity, area...
 * Tự động gắn currentBooking khi phòng đang có khách lưu trú
 * Ẩn ghi chú nội bộ 'notes' trừ khi includeNotes = true (chỉ dành cho ADMIN/RECEPTIONIST)
 */
export function toRoomResponse(
  room: Room & { roomType: RoomType; bookings?: any[] },
  includeNotes = false,
): RoomResponse {
  let currentBooking: RoomCurrentBooking | null = null;
  if (room.bookings && room.bookings.length > 0) {
    const active = room.bookings.find(
      (b) => b.status === BookingStatus.CHECKED_IN,
    );
    if (active) {
      currentBooking = {
        id: active.id,
        bookingCode: active.bookingCode,
        guestName: active.customer?.fullName || 'Khách đang lưu trú',
        guestPhone: active.customer?.phone || null,
        checkOutDate: active.checkOutDate,
      };
    }
  }

  const capacityAdults = room.roomType?.capacityAdults ?? 2;
  const capacityChildren = room.roomType?.capacityChildren ?? 1;
  const sizeSqM = room.roomType?.sizeSqM || 35;

  const res: RoomResponse = {
    id: room.id,
    roomNumber: room.roomNumber,
    floor: room.floor,
    status: room.status,
    roomTypeId: room.roomTypeId,
    roomTypeName: room.roomType?.name || '',
    roomTypeCode: room.roomType?.code || '',
    description: room.roomType?.description || null,
    pricePerNight: room.roomType?.basePrice || 0,
    images: room.roomType?.images || [],
    amenities: room.roomType?.amenities || [],
    capacityAdults,
    capacityChildren,
    capacity: capacityAdults + capacityChildren,
    sizeSqM,
    area: sizeSqM,
    rating: 4.9,
    reviewCount: 48,
    currentBooking,
  };

  if (includeNotes && room.notes !== undefined) {
    res.notes = room.notes;
  }

  if (room.bookings) {
    res.bookings = room.bookings;
  }

  return res;
}
