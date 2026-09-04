import { Room, RoomType, RoomStatus, BookingStatus } from '@prisma/client';

export interface RoomCurrentBooking {
  id: string;
  bookingCode: string;
  guestName: string;
  guestPhone: string | null;
  checkOutDate: Date;
}

export interface RoomPolicies {
  checkInTime: string;
  checkOutTime: string;
  cancellation: string;
  smoking: string;
  pet: string;
  children: string;
}

export interface RatingBreakdown {
  cleanliness: number;
  comfort: number;
  location: number;
  service: number;
  value: number;
}

export interface RoomReview {
  id: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  date: string;
  comment: string;
  stayDuration?: string;
}

export interface AmenityGroup {
  groupName: string;
  icon: string;
  items: string[];
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
  bedType: string;
  viewType: string;
  highlights: string[];
  policies: RoomPolicies;
  ratingBreakdown: RatingBreakdown;
  reviews: RoomReview[];
  amenityGroups: AmenityGroup[];
  currentBooking?: RoomCurrentBooking | null;
  bookings?: any[];
  roomType?: RoomType;
}

const DEFAULT_ROOM_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=80',
];

interface RoomTypeMetadata {
  bedType: string;
  viewType: string;
  highlights: string[];
  rating: number;
  reviewCount: number;
  ratingBreakdown: RatingBreakdown;
  amenityGroups: AmenityGroup[];
  reviews: RoomReview[];
}

const ROOM_TYPE_METADATA_MAP: Record<string, RoomTypeMetadata> = {
  'STD-S': {
    bedType: '1 Giường đơn tiêu chuẩn cao cấp (1.2m x 2.0m)',
    viewType: 'Hướng sân trong yên tĩnh (Courtyard View)',
    highlights: [
      'Không gian ấm cúng, tối ưu cho công tác',
      'Wifi tốc độ cao 300Mbps phủ sóng riêng',
      'Bàn làm việc thiết kế công thái học',
      'Miễn phí nước suối, trà và cafe mỗi ngày',
    ],
    rating: 4.8,
    reviewCount: 38,
    ratingBreakdown: {
      cleanliness: 4.9,
      comfort: 4.7,
      location: 4.8,
      service: 4.9,
      value: 4.9,
    },
    amenityGroups: [
      {
        groupName: 'Phòng ngủ & Thư giãn',
        icon: 'bed',
        items: ['Đệm lò xo túi êm ái', 'Bàn làm việc tiện nghi', 'Tủ quần áo gỗ', 'Rèm cản sáng 100%'],
      },
      {
        groupName: 'Phòng tắm & Vệ sinh',
        icon: 'bathtub',
        items: ['Vòi sen đứng nóng lạnh áp lực cao', 'Khăn tắm dệt sợi bông mềm', 'Máy sấy tóc 1800W', 'Bộ đồ dùng cá nhân'],
      },
      {
        groupName: 'Công nghệ & Giải trí',
        icon: 'tv',
        items: ['Smart TV 40 inch', 'Wifi 6 tốc độ cao', 'Ổ cắm sạc USB đầu giường'],
      },
      {
        groupName: 'Ẩm thực & Dịch vụ',
        icon: 'restaurant',
        items: ['Ấm đun nước siêu tốc', 'Miễn phí 2 chai nước khoáng/ngày', 'Dọn phòng hàng ngày'],
      },
    ],
    reviews: [
      {
        id: 'rev-std-1',
        authorName: 'Nguyễn Tiến Dũng',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-08-25',
        comment: 'Phòng sạch sẽ, đệm nằm rất êm lưng. Tôi đi công tác 3 ngày ở đây làm việc rất yên tĩnh và thoải mái.',
        stayDuration: 'Lưu trú 3 đêm',
      },
      {
        id: 'rev-std-2',
        authorName: 'Hoàng Minh Châu',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        rating: 4.8,
        date: '2026-08-18',
        comment: 'Giá cả quá hợp lý so với chất lượng dịch vụ khách sạn 5 sao. Lễ tân nhiệt tình hỗ trợ check-in sớm.',
        stayDuration: 'Lưu trú 1 đêm',
      },
    ],
  },
  'STD-D': {
    bedType: '1 Giường Queen đôi êm ái (1.6m x 2.0m)',
    viewType: 'Hướng vườn hoa nội khu thoáng mát (Garden View)',
    highlights: [
      'Giường Queen đệm cao su non êm ái',
      'Smart TV 43 inch có sẵn Netflix',
      'Minibar đồ uống mát lạnh tại phòng',
      'Miễn phí hủy phòng trước 24 giờ',
    ],
    rating: 4.85,
    reviewCount: 56,
    ratingBreakdown: {
      cleanliness: 4.9,
      comfort: 4.8,
      location: 4.8,
      service: 4.9,
      value: 4.9,
    },
    amenityGroups: [
      {
        groupName: 'Phòng ngủ & Thư giãn',
        icon: 'bed',
        items: ['Giường Queen đệm êm ái', 'Bàn trang điểm & gương soi lớn', 'Két sắt bảo mật điện tử', 'Tủ quần áo rộng rãi'],
      },
      {
        groupName: 'Phòng tắm & Vệ sinh',
        icon: 'bathtub',
        items: ['Phòng tắm kính cao cấp', 'Vòi sen tắm mưa', 'Áo choàng tắm & Dép bông', 'Máy sấy tóc chuyên nghiệp'],
      },
      {
        groupName: 'Công nghệ & Giải trí',
        icon: 'tv',
        items: ['Smart TV 43 inch Full HD', 'Netflix & Youtube miễn phí', 'Wifi băng thông rộng'],
      },
      {
        groupName: 'Ẩm thực & Dịch vụ',
        icon: 'restaurant',
        items: ['Minibar đa dạng thức uống', 'Ấm đun nước', 'Trà & Cà phê phin thơm ngon'],
      },
    ],
    reviews: [
      {
        id: 'rev-stdd-1',
        authorName: 'Lê Thanh Hương',
        authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-08-28',
        comment: 'Hai vợ chồng mình có kỳ nghỉ cuối tuần rất tuyệt vời. Phòng ốc thơm tho, nội thất bài trí rất tinh tế.',
        stayDuration: 'Lưu trú 2 đêm',
      },
      {
        id: 'rev-stdd-2',
        authorName: 'Vũ Quốc Khánh',
        authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
        rating: 4.7,
        date: '2026-08-14',
        comment: 'Phòng đẹp y hình, giường êm ngủ ngon không nghe tiếng ồn bên ngoài. Lễ tân phục vụ rất dễ thương.',
        stayDuration: 'Lưu trú 2 đêm',
      },
    ],
  },
  'SUP-CV': {
    bedType: '1 Giường King đôi lớn (1.8m x 2.0m) hoặc 2 Giường đơn cao cấp',
    viewType: 'Toàn cảnh thành phố nhộn nhịp (City Skyline View)',
    highlights: [
      'Cửa kính chạm trần ngắm trọn thành phố',
      'Bàn trà & ghế armchair đọc sách thư giãn',
      'Bao gồm bữa sáng Buffet Á - Âu miễn phí',
      'Đồ vệ sinh cá nhân thảo mộc cao cấp',
    ],
    rating: 4.9,
    reviewCount: 78,
    ratingBreakdown: {
      cleanliness: 4.9,
      comfort: 4.9,
      location: 5.0,
      service: 4.9,
      value: 4.8,
    },
    amenityGroups: [
      {
        groupName: 'Phòng ngủ & Thư giãn',
        icon: 'bed',
        items: ['Giường King hoặc 2 giường Twin', 'Góc đọc sách thư giãn', 'Cửa kính chạm trần cách âm tuyệt đối', 'Két an toàn'],
      },
      {
        groupName: 'Phòng tắm & Vệ sinh',
        icon: 'bathtub',
        items: ['Phòng tắm ốp đá hoa cương', 'Áo choàng tắm lụa cao cấp', 'Bộ dầu gội thảo dược cao cấp', 'Gương soi viền LED'],
      },
      {
        groupName: 'Công nghệ & Giải trí',
        icon: 'tv',
        items: ['Smart TV 50 inch 4K', 'Truyền hình cáp quốc tế', 'Đầu sạc đa năng & Cổng Type-C'],
      },
      {
        groupName: 'Ẩm thực & Dịch vụ',
        icon: 'restaurant',
        items: ['Buffet sáng miễn phí mỗi ngày', 'Minibar tủ lạnh cao cấp', 'Dịch vụ giặt ủi lấy nhanh'],
      },
    ],
    reviews: [
      {
        id: 'rev-sup-1',
        authorName: 'Đặng Ngọc Ánh',
        authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-08-30',
        comment: 'View ngắm toàn cảnh thành phố về đêm siêu đỉnh! Bữa sáng buffet rất đa dạng món ngon hợp khẩu vị.',
        stayDuration: 'Lưu trú 2 đêm',
      },
      {
        id: 'rev-sup-2',
        authorName: 'Phạm Tuấn Kiệt',
        authorAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80',
        rating: 4.9,
        date: '2026-08-22',
        comment: 'Phòng rộng rãi, sạch bóng loáng không một hạt bụi. Nhân viên dọn phòng rất chu đáo và tinh tế.',
        stayDuration: 'Lưu trú 3 đêm',
      },
    ],
  },
  'DLX-OV': {
    bedType: '1 Giường King đôi siêu lớn (2.0m x 2.2m) đệm lông vũ cao cấp',
    viewType: 'Hướng trực diện biển 180 độ (Ocean Panorama)',
    highlights: [
      'Ban công riêng ngắm bình minh và hoàng hôn biển',
      'Bồn tắm nằm ngắm biển thư giãn với muối khoáng',
      'Máy pha cà phê Nespresso & Loa Bluetooth Marshall',
      'Miễn phí Buffet sáng 5 sao & Trà chiều tại sảnh',
    ],
    rating: 4.95,
    reviewCount: 124,
    ratingBreakdown: {
      cleanliness: 5.0,
      comfort: 5.0,
      location: 5.0,
      service: 4.9,
      value: 4.9,
    },
    amenityGroups: [
      {
        groupName: 'Phòng ngủ & Thư giãn',
        icon: 'bed',
        items: ['Giường King siêu lớn nệm lông vũ', 'Ban công riêng rộng rãi có ghế tắm nắng', 'Rèm mở tự động thông minh', 'Góc thư giãn lãng mạn'],
      },
      {
        groupName: 'Phòng tắm & Vệ sinh',
        icon: 'bathtub',
        items: ['Bồn tắm nằm ngắm biển trực diện', 'Đồ vệ sinh cao cấp L’Occitane', 'Áo choàng tắm waffle siêu êm', 'Vòi sen trần Rain Shower'],
      },
      {
        groupName: 'Công nghệ & Giải trí',
        icon: 'tv',
        items: ['Smart TV 55 inch 4K HDR', 'Loa Bluetooth Marshall Acton', 'Hệ thống điều khiển ánh sáng cảm ứng', 'Wifi 6 cực mạnh'],
      },
      {
        groupName: 'Ẩm thực & Dịch vụ',
        icon: 'restaurant',
        items: ['Máy pha cafe Nespresso kèm viên nén', 'Rượu vang chào mừng tặng kèm', 'Bữa sáng buffet tận phòng theo yêu cầu', 'Dịch vụ dọn phòng 2 lần/ngày'],
      },
    ],
    reviews: [
      {
        id: 'rev-dlx-1',
        authorName: 'Trần Phương Thảo',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-09-01',
        comment: 'Cảm giác ngâm bồn tắm ngắm hoàng hôn buông xuống biển thật sự đắt giá! 10/10 cho trải nghiệm tuyệt vời này.',
        stayDuration: 'Lưu trú 3 đêm',
      },
      {
        id: 'rev-dlx-2',
        authorName: 'Nguyễn Quốc Hưng',
        authorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-08-26',
        comment: 'Phòng đẹp hơn cả trong ảnh. Loa Marshall nghe nhạc cực chill. Dịch vụ đưa đón và phục vụ lễ tân chuyên nghiệp.',
        stayDuration: 'Lưu trú 2 đêm',
      },
    ],
  },
  'SUI-EXEC': {
    bedType: '1 Giường Master King (2.0m x 2.2m) + 1 Sofa bed bọc da cao cấp',
    viewType: 'Tầm nhìn bao quát biển & thành phố từ tầng cao (Executive Horizon)',
    highlights: [
      'Phòng khách và phòng ngủ tách biệt hoàn toàn',
      'Bồn sục Jacuzzi đôi tạo sóng thư giãn chuyên sâu',
      'Đặc quyền vào Executive Lounge & Trà chiều cao cấp',
      'Dịch vụ Quản gia riêng (Butler Service) hỗ trợ 24/7',
    ],
    rating: 4.98,
    reviewCount: 88,
    ratingBreakdown: {
      cleanliness: 5.0,
      comfort: 5.0,
      location: 4.9,
      service: 5.0,
      value: 4.9,
    },
    amenityGroups: [
      {
        groupName: 'Phòng ngủ & Thư giãn',
        icon: 'bed',
        items: ['Phòng khách và phòng ngủ riêng biệt', 'Sofa da thật cao cấp', 'Phòng làm việc chuyên biệt', 'Tủ chứa đồ walk-in closet'],
      },
      {
        groupName: 'Phòng tắm & Vệ sinh',
        icon: 'bathtub',
        items: ['Bồn sục Jacuzzi đôi massage thủy lực', '2 Chậu rửa mặt đôi tiện lợi', 'Phòng xông hơi ướt riêng', 'Mỹ phẩm cao cấp Molton Brown'],
      },
      {
        groupName: 'Công nghệ & Giải trí',
        icon: 'tv',
        items: ['2 Smart TV 65 inch & 55 inch 4K', 'Dàn âm thanh vòm sống động', 'Máy chiếu mini giải trí', 'Đường truyền internet cáp quang riêng'],
      },
      {
        groupName: 'Ẩm thực & Dịch vụ',
        icon: 'restaurant',
        items: ['Đặc quyền Executive Lounge', 'Cocktail & Rượu vang nhẹ buổi tối', 'Bữa sáng phục vụ tại phòng ngủ', 'Dịch vụ Quản gia 24/7'],
      },
    ],
    reviews: [
      {
        id: 'rev-sui-1',
        authorName: 'Doanh nhân David Lâm',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-08-29',
        comment: 'Căn Suite đẳng cấp cho khách thương gia. Phòng họp tiếp khách riêng tư, bồn sục Jacuzzi giúp xua tan mệt mỏi sau ngày làm việc.',
        stayDuration: 'Lưu trú 4 đêm',
      },
      {
        id: 'rev-sui-2',
        authorName: 'Vũ Thị Minh Hằng',
        authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
        rating: 4.9,
        date: '2026-08-20',
        comment: 'Dịch vụ Butler chu đáo đến từng chi tiết nhỏ. Lounge tầng cao view hoàng hôn tuyệt đẹp!',
        stayDuration: 'Lưu trú 2 đêm',
      },
    ],
  },
  'PRE-VIP': {
    bedType: '2 Giường King Hoàng Gia (2.2m x 2.2m) dát gỗ & đệm lông ngỗng 7 lớp',
    viewType: 'Tầm nhìn 360 độ ngắm toàn cảnh biển và đường chân trời (360° Sky Horizon)',
    highlights: [
      'Hồ bơi vô cực mini sân thượng riêng biệt',
      'Phòng xông hơi khô & ướt (Sauna & Steambath) tại phòng',
      'Bếp hiện đại, quầy bar cá nhân & Bàn tiệc 8 người',
      'Đưa đón xe sang Limousine sân bay 2 chiều miễn phí',
    ],
    rating: 5.0,
    reviewCount: 46,
    ratingBreakdown: {
      cleanliness: 5.0,
      comfort: 5.0,
      location: 5.0,
      service: 5.0,
      value: 5.0,
    },
    amenityGroups: [
      {
        groupName: 'Khu vực Nghỉ ngơi & Đẳng cấp',
        icon: 'bed',
        items: ['2 Phòng ngủ Master King siêu sang', 'Hồ bơi vô cực sân thượng riêng', 'Phòng xông hơi Sauna & Đá muối Himalaya', 'Phòng thử đồ thời trang walk-in'],
      },
      {
        groupName: 'Phòng tắm Thượng lưu',
        icon: 'bathtub',
        items: ['Bồn tắm tạo bọt mạ vàng', 'Mỹ phẩm hoàng gia Hermès Paris', 'Hệ thống vòi hoa sen mưa thác nước', 'Gương sưởi chống bám sương'],
      },
      {
        groupName: 'Công nghệ Đỉnh cao',
        icon: 'tv',
        items: ['Smart TV 75 inch 8K OLED', 'Dàn âm thanh Bang & Olufsen đỉnh cao', 'Nhà thông minh Smart Home điều khiển giọng nói', 'Phím bấm một chạm gọi quản gia'],
      },
      {
        groupName: 'Ẩm thực & Dịch vụ VIP',
        icon: 'restaurant',
        items: ['Đầu bếp riêng phục vụ tại phòng', 'Hầm rượu vang thượng hạng cá nhân', 'Đưa đón Limousine 2 chiều', 'Check-in & Check-out riêng tại phòng'],
      },
    ],
    reviews: [
      {
        id: 'rev-pre-1',
        authorName: 'Ông Hoàng Nam Phong',
        authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-08-31',
        comment: 'Căn Penthouse là tuyệt tác nghỉ dưỡng thực sự. Bể bơi vô cực riêng ngắm toàn cảnh biển mang lại trải nghiệm đỉnh cao không thể quên.',
        stayDuration: 'Lưu trú 2 đêm',
      },
      {
        id: 'rev-pre-2',
        authorName: 'Bà Mai Phương Thúy',
        authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
        rating: 5.0,
        date: '2026-08-15',
        comment: 'Gia đình chúng tôi tổ chức tiệc sinh nhật ở đây vô cùng hài lòng. Đầu bếp nấu ăn rất ngon, đội ngũ phục vụ đẳng cấp 5 sao quốc tế.',
        stayDuration: 'Lưu trú 3 đêm',
      },
    ],
  },
};

const DEFAULT_POLICIES: RoomPolicies = {
  checkInTime: '14:00',
  checkOutTime: '12:00',
  cancellation: 'Miễn phí hủy phòng trước 24 giờ trước thời điểm nhận phòng (hoàn tiền 100%)',
  smoking: 'Phòng không hút thuốc (Có ban công hoặc khu vực dành riêng ngoài trời)',
  pet: 'Không mang theo thú cưng vào khuôn viên phòng nghỉ',
  children: 'Trẻ em dưới 6 tuổi được ở miễn phí khi ngủ chung giường với bố mẹ',
};

/**
 * Mapper chuẩn hóa dữ liệu phòng (BE-3, BE-10 & Claude Artifact Section 04)
 * Phẳng hóa thông tin từ roomType để FE sử dụng trực tiếp: image, imageUrl, images, amenities, pricePerNight, capacity, area...
 * Tự động bổ sung chi tiết: bedType, viewType, highlights, policies, ratingBreakdown, reviews, amenityGroups
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

  const code = room.roomType?.code || 'STD-D';
  const meta = ROOM_TYPE_METADATA_MAP[code] || ROOM_TYPE_METADATA_MAP['STD-D'];

  const res: RoomResponse = {
    id: room.id,
    roomNumber: room.roomNumber,
    floor: room.floor,
    status: room.status,
    roomTypeId: room.roomTypeId,
    roomTypeName: room.roomType?.name || '',
    roomTypeCode: code,
    description: room.roomType?.description || null,
    pricePerNight: room.roomType?.basePrice || 0,
    image: primaryImage,
    imageUrl: primaryImage,
    images,
    amenities: room.roomType?.amenities && room.roomType.amenities.length > 0
      ? room.roomType.amenities
      : [
          'Wifi tốc độ cao miễn phí',
          'Điều hòa nhiệt độ 2 chiều',
          'Smart TV 4K Ultra HD',
          'Ấm đun nước siêu tốc & Minibar',
          'Phòng tắm kính vòi sen nóng lạnh',
          'Máy sấy tóc & Két an toàn',
        ],
    capacityAdults,
    capacityChildren,
    capacity: capacityAdults + capacityChildren,
    sizeSqM,
    area: sizeSqM,
    rating: meta.rating,
    reviewCount: meta.reviewCount,
    bedType: meta.bedType,
    viewType: meta.viewType,
    highlights: meta.highlights,
    policies: DEFAULT_POLICIES,
    ratingBreakdown: meta.ratingBreakdown,
    reviews: meta.reviews,
    amenityGroups: meta.amenityGroups,
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

