import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  PrismaClient,
  Role,
  RoomStatus,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { syncDatabaseSchema } from './schema-sync';
import { HISTORY_YEARS, seedHistoricalYears } from './history-seed';

function formatDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Nếu là database cloud (như Render, Neon, Supabase...) và chưa có cấu hình sslmode
  const isCloudDb = !url.includes('localhost') && !url.includes('127.0.0.1');
  if (isCloudDb && !url.includes('sslmode=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}sslmode=require&connect_timeout=30&pool_timeout=30`;
  }
  return url;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const formattedUrl = formatDatabaseUrl();
    super(
      formattedUrl
        ? {
            datasources: {
              db: {
                url: formattedUrl,
              },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        await this.$connect();
        this.logger.log('✅ Kết nối cơ sở dữ liệu PostgreSQL thành công!');
        // Vá cấu trúc bảng TRƯỚC khi seed / phục vụ request, tránh lỗi P2022
        // khi `prisma db push` lúc deploy bị bỏ qua vì cảnh báo mất dữ liệu.
        await syncDatabaseSchema((sql) => this.$executeRawUnsafe(sql), this.logger);
        await this.ensureInitialSeed();
        return;
      } catch (error: any) {
        if (attempt < maxRetries) {
          this.logger.warn(
            `⚠️ Lỗi kết nối DB (${error.message}). Đang thử lại lần ${attempt}/${maxRetries} sau 3 giây...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          this.logger.error(
            `❌ Không thể kết nối cơ sở dữ liệu PostgreSQL (${error.message}). ` +
              `Vui lòng kiểm tra biến môi trường DATABASE_URL trong phần Environment của Render/Hosting.`,
          );
          throw error;
        }
      }
    }
  }

  private async ensureInitialSeed() {
    try {
      this.logger.log('🔄 Đang đồng bộ và kiểm tra dữ liệu mẫu cho từng Role...');

      // 1. TÀI KHOẢN NGƯỜI DÙNG CHO CÁC ROLE
      const salt = await bcrypt.genSalt(10);
      const adminPassword = await bcrypt.hash('Admin@123', salt);
      const staffPassword = await bcrypt.hash('Staff@123', salt);
      const custPassword = await bcrypt.hash('Cust@123', salt);

      const defaultAccounts = [
        // ADMIN
        {
          email: 'admin@hotel.com',
          password: adminPassword,
          fullName: 'Nguyễn Văn Quản Trị (Super Admin)',
          phone: '0901112233',
          role: Role.ADMIN,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        },
        {
          email: 'director@hotel.com',
          password: adminPassword,
          fullName: 'Trần Đình Giám Đốc (General Manager)',
          phone: '0902223344',
          role: Role.ADMIN,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        },
        // RECEPTIONIST
        {
          email: 'reception@hotel.com',
          password: staffPassword,
          fullName: 'Lê Thu Hà (Trưởng ca Lễ tân)',
          phone: '0903334455',
          role: Role.RECEPTIONIST,
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        },
        {
          email: 'reception.morning@hotel.com',
          password: staffPassword,
          fullName: 'Nguyễn Minh Trang (Lễ tân Ca sáng)',
          phone: '0904445566',
          role: Role.RECEPTIONIST,
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        },
        // RECEPTIONIST (Lễ tân – Thu ngân)
        {
          email: 'cashier@hotel.com',
          password: staffPassword,
          fullName: 'Trần Văn Minh (Thu ngân Quầy sảnh)',
          phone: '0906667788',
          role: Role.RECEPTIONIST,
          avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
        },
        {
          email: 'cashier.accounting@hotel.com',
          password: staffPassword,
          fullName: 'Vũ Thị Bích Ngọc (Kế toán Thu chi)',
          phone: '0907778899',
          role: Role.RECEPTIONIST,
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        },
        // CUSTOMER
        {
          email: 'customer@hotel.com',
          password: custPassword,
          fullName: 'Nguyễn Anh Tuấn (Khách VIP Platinum)',
          phone: '0918889900',
          role: Role.CUSTOMER,
          avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
        },
        {
          email: 'khachhang1@gmail.com',
          password: custPassword,
          fullName: 'Phạm Thị Mai (Khách Cặp đôi)',
          phone: '0981112244',
          role: Role.CUSTOMER,
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        },
        {
          email: 'customer.john@gmail.com',
          password: custPassword,
          fullName: 'Johnathan Miller (Khách Quốc tế)',
          phone: '0935558899',
          role: Role.CUSTOMER,
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
        },
      ];

      const usersMap: Record<string, any> = {};
      for (const acc of defaultAccounts) {
        let u = await this.user.findUnique({ where: { email: acc.email } });
        if (!u) {
          u = await this.user.create({
            data: {
              email: acc.email,
              password: acc.password,
              fullName: acc.fullName,
              phone: acc.phone,
              role: acc.role,
              avatar: acc.avatar,
              isActive: true,
            },
          });
        } else {
          u = await this.user.update({
            where: { email: acc.email },
            data: {
              password: acc.password,
              role: acc.role,
              isActive: true,
            },
          });
        }
        usersMap[acc.email] = u;
      }

      // 2. LOẠI PHÒNG (ROOM TYPES)
      const roomTypeConfigs = [
        {
          code: 'STD-S',
          name: 'Standard Single Room',
          description: 'Phòng tiêu chuẩn 1 giường đơn ấm cúng, tối ưu chi phí cho khách công tác.',
          basePrice: 450000,
          capacityAdults: 1,
          capacityChildren: 0,
          sizeSqM: 20,
          amenities: ['Wifi tốc độ cao', 'Điều hòa 2 chiều', 'Smart TV 40 inch', 'Ấm đun nước', 'Bàn làm việc'],
          images: [
            'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=1000&q=80',
          ],
        },
        {
          code: 'STD-D',
          name: 'Standard Queen Double',
          description: 'Phòng tiêu chuẩn 1 giường đôi Queen êm ái, đầy đủ trang thiết bị hiện đại.',
          basePrice: 650000,
          capacityAdults: 2,
          capacityChildren: 1,
          sizeSqM: 28,
          amenities: ['Wifi tốc độ cao', 'Điều hòa Inverter', 'Smart TV 43 inch', 'Minibar mini', 'Máy sấy tóc'],
          images: [
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1000&q=80',
          ],
        },
        {
          code: 'SUP-CV',
          name: 'Superior City View',
          description: 'Phòng Superior cửa kính lớn nhìn toàn cảnh thành phố nhộn nhịp, góc đọc sách thư giãn.',
          basePrice: 950000,
          capacityAdults: 2,
          capacityChildren: 1,
          sizeSqM: 35,
          amenities: ['Cửa kính view thành phố', 'Bàn trà & ghế đọc sách', 'Smart TV 50 inch 4K', 'Áo choàng tắm', 'Minibar'],
          images: [
            'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
          ],
        },
        {
          code: 'DLX-OV',
          name: 'Deluxe Ocean Panorama',
          description: 'Phòng Deluxe ban công riêng view biển ngoạn mục, bồn tắm nằm cao cấp ngắm hoàng hôn.',
          basePrice: 1450000,
          capacityAdults: 2,
          capacityChildren: 2,
          sizeSqM: 45,
          amenities: ['Ban công riêng view biển', 'Bồn tắm ngắm biển', 'Máy pha cà phê', 'Loa Bluetooth Marshall'],
          images: [
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1000&q=80',
          ],
        },
        {
          code: 'SUI-EXEC',
          name: 'Executive Business Suite',
          description: 'Căn hộ Suite chuẩn thượng lưu với phòng khách riêng, phòng làm việc chuyên nghiệp, bồn Jacuzzi.',
          basePrice: 2800000,
          capacityAdults: 3,
          capacityChildren: 2,
          sizeSqM: 75,
          amenities: ['Phòng khách và phòng ngủ riêng', 'Bồn sục Jacuzzi đôi', 'Quầy bar mini', 'Dịch vụ Butler 24/7'],
          images: [
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=80',
          ],
        },
        {
          code: 'PRE-VIP',
          name: 'Presidential Penthouse Suite',
          description: 'Đỉnh cao phong cách nghỉ dưỡng tầng cao nhất với hồ bơi vô cực mini riêng và view 360 độ.',
          basePrice: 5500000,
          capacityAdults: 4,
          capacityChildren: 2,
          sizeSqM: 130,
          amenities: ['Hồ bơi vô cực mini sân thượng', 'Phòng xông hơi Sauna', 'Bếp hiện đại & Bàn tiệc', 'Đưa đón Limousine'],
          images: [
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=1000&q=80',
          ],
        },
      ];

      const roomTypesMap: Record<string, any> = {};
      for (const rt of roomTypeConfigs) {
        let type = await this.roomType.findUnique({ where: { code: rt.code } });
        if (!type) {
          type = await this.roomType.create({ data: rt });
        }
        roomTypesMap[rt.code] = type;
      }

      // 3. DANH SÁCH PHÒNG (ROOMS)
      const roomsConfig = [
        { roomNumber: '101', floor: 1, typeCode: 'STD-S', status: RoomStatus.AVAILABLE },
        { roomNumber: '102', floor: 1, typeCode: 'STD-S', status: RoomStatus.AVAILABLE },
        { roomNumber: '103', floor: 1, typeCode: 'STD-D', status: RoomStatus.OCCUPIED },
        { roomNumber: '104', floor: 1, typeCode: 'STD-D', status: RoomStatus.CLEANING, notes: 'Đang dọn phòng' },
        { roomNumber: '201', floor: 2, typeCode: 'SUP-CV', status: RoomStatus.OCCUPIED },
        { roomNumber: '202', floor: 2, typeCode: 'SUP-CV', status: RoomStatus.AVAILABLE },
        { roomNumber: '203', floor: 2, typeCode: 'SUP-CV', status: RoomStatus.RESERVED, notes: 'Khách cọc nhận phòng hôm nay' },
        { roomNumber: '204', floor: 2, typeCode: 'SUP-CV', status: RoomStatus.MAINTENANCE, notes: 'Bảo trì thay vòi sen' },
        { roomNumber: '301', floor: 3, typeCode: 'DLX-OV', status: RoomStatus.OCCUPIED },
        { roomNumber: '302', floor: 3, typeCode: 'DLX-OV', status: RoomStatus.AVAILABLE },
        { roomNumber: '303', floor: 3, typeCode: 'DLX-OV', status: RoomStatus.AVAILABLE },
        { roomNumber: '304', floor: 3, typeCode: 'DLX-OV', status: RoomStatus.CLEANING, notes: 'Khử trùng sau trả phòng' },
        { roomNumber: '401', floor: 4, typeCode: 'SUI-EXEC', status: RoomStatus.OCCUPIED },
        { roomNumber: '402', floor: 4, typeCode: 'SUI-EXEC', status: RoomStatus.AVAILABLE },
        { roomNumber: '403', floor: 4, typeCode: 'SUI-EXEC', status: RoomStatus.RESERVED, notes: 'Đoàn công tác đối tác' },
        { roomNumber: '404', floor: 4, typeCode: 'SUI-EXEC', status: RoomStatus.AVAILABLE },
        { roomNumber: '501', floor: 5, typeCode: 'PRE-VIP', status: RoomStatus.AVAILABLE },
        { roomNumber: '502', floor: 5, typeCode: 'PRE-VIP', status: RoomStatus.RESERVED, notes: 'Đặt tiệc sinh nhật cuối tuần' },
      ];

      const roomsMap: Record<string, any> = {};
      for (const r of roomsConfig) {
        const type = roomTypesMap[r.typeCode];
        if (!type) continue;
        let room = await this.room.findUnique({ where: { roomNumber: r.roomNumber } });
        if (!room) {
          room = await this.room.create({
            data: {
              roomNumber: r.roomNumber,
              floor: r.floor,
              roomTypeId: type.id,
              status: r.status,
              notes: r.notes,
            },
          });
        } else {
          room = await this.room.update({
            where: { roomNumber: r.roomNumber },
            data: {
              status: r.status,
              notes: r.notes,
            },
          });
        }
        roomsMap[r.roomNumber] = room;
      }

      // 4. ĐƠN ĐẶT PHÒNG (BOOKINGS) CHO RECEPTIONIST, CUSTOMER, ADMIN
      const now = new Date();
      const dAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const dAhead = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const customerUser = usersMap['customer@hotel.com'] || usersMap['khachhang1@gmail.com'];
      const customerOther = usersMap['customer.john@gmail.com'] || customerUser;
      const cashierUser = usersMap['cashier@hotel.com'];

      if (customerUser && roomsMap['301']) {
        // Booking 1: CHECKED_IN - customer@hotel.com tại phòng 301 (Deluxe Ocean)
        let b1 = await this.booking.findUnique({ where: { bookingCode: 'BK-2026-001' } });
        if (!b1) {
          b1 = await this.booking.create({
            data: {
              bookingCode: 'BK-2026-001',
              customerId: customerUser.id,
              roomId: roomsMap['301'].id,
              checkInDate: dAgo(1),
              checkOutDate: dAhead(2),
              actualCheckIn: dAgo(1),
              guestCount: 2,
              totalAmount: 4350000,
              depositAmount: 2000000,
              status: BookingStatus.CHECKED_IN,
              specialRequests: 'Kỷ niệm ngày cưới, setup hoa hồng và bánh kem chúc mừng',
            },
          });

          // Dịch vụ phụ trợ cho BK-2026-001
          await this.extraServiceOrder.createMany({
            data: [
              { bookingId: b1.id, serviceName: 'Rượu vang đỏ Chile cao cấp (Chai 750ml)', unitPrice: 650000, quantity: 1, totalPrice: 650000 },
              { bookingId: b1.id, serviceName: 'Bia Heineken lon 330ml', unitPrice: 45000, quantity: 4, totalPrice: 180000 },
              { bookingId: b1.id, serviceName: 'Liệu trình Massage & Spa Trị liệu Cặp đôi (90 phút)', unitPrice: 900000, quantity: 1, totalPrice: 900000 },
            ],
            skipDuplicates: true,
          });

          // Hóa đơn cho BK-2026-001 (PARTIAL - Đã cọc 2tr)
          await this.invoice.create({
            data: {
              invoiceCode: 'INV-2026-002',
              bookingId: b1.id,
              roomAmount: 4350000,
              servicesAmount: 1730000,
              discount: 200000,
              tax: 588000,
              finalAmount: 6468000,
              paidAmount: 2000000,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              paymentStatus: PaymentStatus.PARTIAL,
              issuedById: cashierUser?.id,
              notes: 'Khách đã cọc 2.000.000 VND chuyển khoản Vietcombank khi check-in, phần còn lại thanh toán khi check-out',
            },
          });
        }
      }

      if (customerUser && roomsMap['101']) {
        // Booking 2: CHECKED_OUT - customer@hotel.com đã ở phòng 101 tuần trước
        let b2 = await this.booking.findUnique({ where: { bookingCode: 'BK-2026-003' } });
        if (!b2) {
          b2 = await this.booking.create({
            data: {
              bookingCode: 'BK-2026-003',
              customerId: customerUser.id,
              roomId: roomsMap['101'].id,
              checkInDate: dAgo(6),
              checkOutDate: dAgo(3),
              actualCheckIn: dAgo(6),
              actualCheckOut: dAgo(3),
              guestCount: 1,
              totalAmount: 1350000,
              depositAmount: 500000,
              status: BookingStatus.CHECKED_OUT,
            },
          });

          await this.extraServiceOrder.createMany({
            data: [
              { bookingId: b2.id, serviceName: 'Nước suối khoáng Evian 500ml', unitPrice: 40000, quantity: 2, totalPrice: 80000 },
              { bookingId: b2.id, serviceName: 'Hạt điều rang muối thượng hạng', unitPrice: 60000, quantity: 1, totalPrice: 60000 },
            ],
            skipDuplicates: true,
          });

          // Hóa đơn đã thanh toán đầy đủ (PAID - CREDIT_CARD)
          await this.invoice.create({
            data: {
              invoiceCode: 'INV-2026-001',
              bookingId: b2.id,
              roomAmount: 1350000,
              servicesAmount: 140000,
              discount: 50000,
              tax: 144000,
              finalAmount: 1584000,
              paidAmount: 1584000,
              paymentMethod: PaymentMethod.CREDIT_CARD,
              paymentStatus: PaymentStatus.PAID,
              issuedById: cashierUser?.id,
              paidAt: dAgo(3),
              notes: 'Khách thanh toán thẻ Visa contactless tại quầy thu ngân',
            },
          });
        }
      }

      if (customerUser && roomsMap['203']) {
        // Booking 3: CONFIRMED - customer@hotel.com cọc nhận phòng ngày mai
        let b3 = await this.booking.findUnique({ where: { bookingCode: 'BK-2026-004' } });
        if (!b3) {
          b3 = await this.booking.create({
            data: {
              bookingCode: 'BK-2026-004',
              customerId: customerUser.id,
              roomId: roomsMap['203'].id,
              checkInDate: dAhead(1),
              checkOutDate: dAhead(4),
              guestCount: 3,
              totalAmount: 2850000,
              depositAmount: 1000000,
              status: BookingStatus.CONFIRMED,
              specialRequests: 'Gia đình có em bé nhỏ 3 tuổi, cần nôi em bé và phòng không mùi khói thuốc',
            },
          });

          await this.invoice.create({
            data: {
              invoiceCode: 'INV-2026-003',
              bookingId: b3.id,
              roomAmount: 2850000,
              servicesAmount: 0,
              discount: 0,
              tax: 285000,
              finalAmount: 3135000,
              paidAmount: 1000000,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              paymentStatus: PaymentStatus.PARTIAL,
              issuedById: cashierUser?.id,
              notes: 'Tiền cọc giữ phòng qua quét mã VietQR',
            },
          });
        }
      }

      if (customerOther && roomsMap['401']) {
        // Booking 4: CHECKED_IN - Khách quốc tế tại phòng Suite 401
        let b4 = await this.booking.findUnique({ where: { bookingCode: 'BK-2026-002' } });
        if (!b4) {
          b4 = await this.booking.create({
            data: {
              bookingCode: 'BK-2026-002',
              customerId: customerOther.id,
              roomId: roomsMap['401'].id,
              checkInDate: dAgo(2),
              checkOutDate: dAhead(1),
              actualCheckIn: dAgo(2),
              guestCount: 2,
              totalAmount: 8400000,
              depositAmount: 4000000,
              status: BookingStatus.CHECKED_IN,
              specialRequests: 'Cần đưa đón sân bay và xuất hóa đơn VAT công ty',
            },
          });

          await this.extraServiceOrder.createMany({
            data: [
              { bookingId: b4.id, serviceName: 'Dịch vụ xe Limousine đưa đón sân bay 2 chiều', unitPrice: 800000, quantity: 1, totalPrice: 800000 },
              { bookingId: b4.id, serviceName: 'Buffet sáng quốc tế phục vụ tại phòng', unitPrice: 250000, quantity: 2, totalPrice: 500000 },
              { bookingId: b4.id, serviceName: 'Giặt ủi đồ vest công sở hỏa tốc', unitPrice: 150000, quantity: 2, totalPrice: 300000 },
            ],
            skipDuplicates: true,
          });

          await this.invoice.create({
            data: {
              invoiceCode: 'INV-2026-004',
              bookingId: b4.id,
              roomAmount: 8400000,
              servicesAmount: 1600000,
              discount: 0,
              tax: 1000000,
              finalAmount: 11000000,
              paidAmount: 4000000,
              paymentMethod: PaymentMethod.CREDIT_CARD,
              paymentStatus: PaymentStatus.PARTIAL,
              issuedById: cashierUser?.id,
              notes: 'Khách quốc tế, thanh toán phần còn lại khi trả phòng',
            },
          });
        }
      }

      if (customerUser && roomsMap['501']) {
        // Booking 5: PENDING - customer@hotel.com đặt Penthouse chờ duyệt
        let b5 = await this.booking.findUnique({ where: { bookingCode: 'BK-2026-005' } });
        if (!b5) {
          await this.booking.create({
            data: {
              bookingCode: 'BK-2026-005',
              customerId: customerUser.id,
              roomId: roomsMap['501'].id,
              checkInDate: dAhead(5),
              checkOutDate: dAhead(7),
              guestCount: 2,
              totalAmount: 11000000,
              depositAmount: 0,
              status: BookingStatus.PENDING,
              specialRequests: 'Đặt tiệc tối lãng mạn cạnh hồ bơi mini sân thượng',
            },
          });
        }
      }

      if (customerUser && roomsMap['102']) {
        // Booking 6: CANCELLED
        let b6 = await this.booking.findUnique({ where: { bookingCode: 'BK-2026-006' } });
        if (!b6) {
          await this.booking.create({
            data: {
              bookingCode: 'BK-2026-006',
              customerId: customerUser.id,
              roomId: roomsMap['102'].id,
              checkInDate: dAgo(10),
              checkOutDate: dAgo(8),
              guestCount: 1,
              totalAmount: 900000,
              depositAmount: 0,
              status: BookingStatus.CANCELLED,
              specialRequests: 'Bận chuyến bay đột xuất xin phép hủy phòng',
            },
          });
        }
      }

      // 5. OTP TEST QUÊN MẬT KHẨU
      const existingOtp = await this.passwordReset.findFirst({ where: { email: 'customer@hotel.com' } });
      if (!existingOtp) {
        await this.passwordReset.create({
          data: {
            email: 'customer@hotel.com',
            otp: '123456',
            token: 'demo-reset-token-for-customer-hotel-2026',
            expiresAt: dAhead(7),
            used: false,
          },
        });
      }

      // 6. DỮ LIỆU LỊCH SỬ CÁC NĂM TRƯỚC (Báo cáo doanh thu 12 tháng & Hiệu suất nhân sự)
      // Chỉ dựng cho năm nào chưa có, nên khởi động lại app không bị nhân đôi số liệu.
      await seedHistoricalYears(this, {
        log: (msg) => this.logger.log(msg.trim()),
      });

      this.logger.log('🎉 ĐÃ KHỞI TẠO ĐẦY ĐỦ DỮ LIỆU CÁC BẢNG CHO TỪNG ROLE:');
      this.logger.log(
        `📈 BÁO CÁO: Đã có dữ liệu doanh thu & hiệu suất nhân sự các năm ${HISTORY_YEARS.join(', ')}.`,
      );
      this.logger.log('👑 ADMIN (admin@hotel.com): Toàn bộ thống kê, người dùng, phòng, hóa đơn, doanh thu.');
      this.logger.log('🛎️ LỄ TÂN (reception@hotel.com): 18 phòng (5 trạng thái), 6 đơn đặt phòng (Đang ở, Sắp tới, Chờ duyệt, Trả phòng, Đã hủy).');
      this.logger.log('💳 THU NGÂN (cashier@hotel.com): 4 hóa đơn (PAID, PARTIAL), 8 dịch vụ phụ trợ (Minibar, Spa, Xe Limousine, Buffet).');
      this.logger.log('👤 KHÁCH HÀNG (customer@hotel.com): Đang lưu trú phòng 301 view biển, 1 đơn sắp tới, 1 đơn lịch sử, hóa đơn & dịch vụ.');
    } catch (err: any) {
      this.logger.warn(`⚠️ Bỏ qua auto-seed (${err.message}). Ứng dụng vẫn hoạt động bình thường.`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
