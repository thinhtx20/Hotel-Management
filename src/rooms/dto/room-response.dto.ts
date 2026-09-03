import { Room, RoomType, RoomStatus } from '@prisma/client';

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
  sizeSqM: number | null;
  bookings?: any[];
}

/**
 * Mapper chuẩn hóa dữ liệu phòng (BE-3 & BE-10)
 * Phẳng hóa thông tin từ roomType để FE sử dụng trực tiếp: images, amenities, pricePerNight...
 * Ẩn ghi chú nội bộ 'notes' trừ khi includeNotes = true (chỉ dành cho ADMIN/RECEPTIONIST)
 */
export function toRoomResponse(
  room: Room & { roomType: RoomType; bookings?: any[] },
  includeNotes = false,
): RoomResponse {
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
    capacityAdults: room.roomType?.capacityAdults ?? 2,
    capacityChildren: room.roomType?.capacityChildren ?? 1,
    sizeSqM: room.roomType?.sizeSqM || null,
  };

  if (includeNotes && room.notes !== undefined) {
    res.notes = room.notes;
  }

  if (room.bookings) {
    res.bookings = room.bookings;
  }

  return res;
}
