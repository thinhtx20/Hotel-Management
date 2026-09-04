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
  image: string;
  imageUrl: string;
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
  roomType?: RoomType;
}

const DEFAULT_ROOM_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
];

/**
 * Mapper chuẩn hóa dữ liệu phòng (BE-3, BE-10 & Claude Artifact Section 04)
 * Phẳng hóa thông tin từ roomType để FE sử dụng trực tiếp: image, imageUrl, images, amenities, pricePerNight, capacity, area...
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

  const rawImages = room.roomType?.images || [];
  const images = rawImages.length > 0 ? rawImages : DEFAULT_ROOM_FALLBACK_IMAGES;
  const primaryImage = images[0] || DEFAULT_ROOM_FALLBACK_IMAGES[0];

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
    image: primaryImage,
    imageUrl: primaryImage,
    images,
    amenities: room.roomType?.amenities || [],
    capacityAdults,
    capacityChildren,
    capacity: capacityAdults + capacityChildren,
    sizeSqM,
    area: sizeSqM,
    rating: 4.9,
    reviewCount: 48,
    currentBooking,
    roomType: room.roomType,
  };

  if (includeNotes && room.notes !== undefined) {
    res.notes = room.notes;
  }

  if (room.bookings) {
    res.bookings = room.bookings;
  }

  return res;
}
