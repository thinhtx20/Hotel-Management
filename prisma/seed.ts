import { PrismaClient, Role, RoomStatus, BookingStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu gieo dữ liệu mẫu (Seeding data)...');

  // 1. Dọn dẹp dữ liệu cũ (tuần tự theo quan hệ ngoại)
  await prisma.extraServiceOrder.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.roomType.deleteMany({});
  await prisma.user.deleteMany({});

  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@123', salt);
  const staffPassword = await bcrypt.hash('Staff@123', salt);
  const customerPassword = await bcrypt.hash('Cust@123', salt);

  // 2. Tạo Users mẫu
  const admin = await prisma.user.create({
    data: {
      email: 'admin@hotel.com',
      password: adminPassword,
      fullName: 'Quản lý Hệ thống',
      phone: '0901112233',
      role: Role.ADMIN,
    },
  });

  const receptionist = await prisma.user.create({
    data: {
      email: 'reception@hotel.com',
      password: staffPassword,
      fullName: 'Lê Thu Hà (Lễ tân)',
      phone: '0904445566',
      role: Role.RECEPTIONIST,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@hotel.com',
      password: staffPassword,
      fullName: 'Trần Văn Minh (Thu ngân)',
      phone: '0907778899',
      role: Role.CASHIER,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      email: 'khachhang1@gmail.com',
      password: customerPassword,
      fullName: 'Nguyễn Anh Tuấn',
      phone: '0918889900',
      role: Role.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'khachhang2@gmail.com',
      password: customerPassword,
      fullName: 'Phạm Thị Mai',
      phone: '0981112244',
      role: Role.CUSTOMER,
    },
  });

  console.log('✅ Đã tạo tài khoản Admin, Lễ tân, Thu ngân và Khách hàng');

  // 3. Tạo Loại phòng (Room Types)
  const standardType = await prisma.roomType.create({
    data: {
      name: 'Standard Queen Room',
      code: 'STD-Q',
      description: 'Phòng tiêu chuẩn ấm cúng, giường Queen, phù hợp khách lẻ hoặc công tác.',
      basePrice: 650000,
      capacityAdults: 2,
      capacityChildren: 1,
      sizeSqM: 26,
      amenities: ['Wifi tốc độ cao', 'Điều hòa 2 chiều', 'Smart TV 43"', 'Ấm đun nước', 'Vòi sen tắm đứng'],
      images: [
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
      ],
    },
  });

  const deluxeType = await prisma.roomType.create({
    data: {
      name: 'Deluxe Ocean View',
      code: 'DLX-OV',
      description: 'Phòng Deluxe ban công hướng biển tuyệt đẹp, bồn tắm nằm cao cấp.',
      basePrice: 1250000,
      capacityAdults: 2,
      capacityChildren: 2,
      sizeSqM: 40,
      amenities: ['Ban công view biển', 'Bồn tắm nằm', 'Minibar miễn phí nước ngọt', 'Smart TV 55"', 'Bàn làm việc'],
      images: [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
      ],
    },
  });

  const suiteType = await prisma.roomType.create({
    data: {
      name: 'Executive Suite',
      code: 'SUI-EXEC',
      description: 'Căn hộ Suite sang trọng với phòng khách riêng biệt, quầy bar mini và view toàn cảnh thành phố.',
      basePrice: 2800000,
      capacityAdults: 4,
      capacityChildren: 2,
      sizeSqM: 75,
      amenities: ['Phòng khách riêng', '2 Giường King', 'Bồn sục Jacuzzi', 'Máy pha cà phê Nespresso', 'Butler service 24/7'],
      images: [
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
      ],
    },
  });

  console.log('✅ Đã tạo các loại phòng Standard, Deluxe, Executive Suite');

  // 4. Tạo Danh sách phòng (Rooms)
  const room101 = await prisma.room.create({
    data: { roomNumber: '101', floor: 1, roomTypeId: standardType.id, status: RoomStatus.AVAILABLE },
  });
  const room102 = await prisma.room.create({
    data: { roomNumber: '102', floor: 1, roomTypeId: standardType.id, status: RoomStatus.AVAILABLE },
  });
  const room103 = await prisma.room.create({
    data: { roomNumber: '103', floor: 1, roomTypeId: standardType.id, status: RoomStatus.CLEANING },
  });

  const room201 = await prisma.room.create({
    data: { roomNumber: '201', floor: 2, roomTypeId: deluxeType.id, status: RoomStatus.OCCUPIED },
  });
  const room202 = await prisma.room.create({
    data: { roomNumber: '202', floor: 2, roomTypeId: deluxeType.id, status: RoomStatus.AVAILABLE },
  });
  const room203 = await prisma.room.create({
    data: { roomNumber: '203', floor: 2, roomTypeId: deluxeType.id, status: RoomStatus.AVAILABLE },
  });

  const room301 = await prisma.room.create({
    data: { roomNumber: '301', floor: 3, roomTypeId: suiteType.id, status: RoomStatus.AVAILABLE },
  });
  const room302 = await prisma.room.create({
    data: { roomNumber: '302', floor: 3, roomTypeId: suiteType.id, status: RoomStatus.MAINTENANCE, notes: 'Đang bảo dưỡng điều hòa trung tâm' },
  });

  console.log('✅ Đã tạo 8 phòng thuộc các tầng 1, 2, 3');

  // 5. Tạo Booking & Invoice mẫu (Khách đang ở phòng 201)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const activeBooking = await prisma.booking.create({
    data: {
      bookingCode: 'BK-888001',
      customerId: customer1.id,
      roomId: room201.id,
      checkInDate: yesterday,
      checkOutDate: tomorrow,
      actualCheckIn: yesterday,
      guestCount: 2,
      totalAmount: 2500000, // 2 đêm x 1.250.000
      depositAmount: 1000000,
      status: BookingStatus.CHECKED_IN,
      specialRequests: 'Trăng mật kỷ niệm ngày cưới, setup hoa tươi trong phòng',
    },
  });

  // Dịch vụ minibar cho phòng 201
  await prisma.extraServiceOrder.createMany({
    data: [
      {
        bookingId: activeBooking.id,
        serviceName: 'Bia Heineken lon',
        unitPrice: 45000,
        quantity: 2,
        totalPrice: 90000,
      },
      {
        bookingId: activeBooking.id,
        serviceName: 'Hạt điều rang muối cao cấp',
        unitPrice: 65000,
        quantity: 1,
        totalPrice: 65000,
      },
    ],
  });

  // Một đơn đặt phòng đã hoàn tất và thanh toán (phòng 101)
  const pastCheckIn = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const pastCheckOut = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const completedBooking = await prisma.booking.create({
    data: {
      bookingCode: 'BK-777002',
      customerId: customer2.id,
      roomId: room101.id,
      checkInDate: pastCheckIn,
      checkOutDate: pastCheckOut,
      actualCheckIn: pastCheckIn,
      actualCheckOut: pastCheckOut,
      guestCount: 1,
      totalAmount: 1300000, // 2 đêm x 650.000
      depositAmount: 500000,
      status: BookingStatus.CHECKED_OUT,
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceCode: 'INV-2026-001',
      bookingId: completedBooking.id,
      roomAmount: 1300000,
      servicesAmount: 120000,
      discount: 50000,
      tax: 137000,
      finalAmount: 1507000,
      paidAmount: 1507000,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      paymentStatus: PaymentStatus.PAID,
      issuedById: cashier.id,
      paidAt: pastCheckOut,
    },
  });

  console.log('✅ Đã tạo dữ liệu mẫu Booking, Dịch vụ phụ trợ và Hóa đơn');
  console.log('🎉 Gieo dữ liệu thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
