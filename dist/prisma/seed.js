"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('===========================================================');
    console.log('🏨 BẮT ĐẦU TẠO DỮ LIỆU MẪU TOÀN DIỆN CHO HOTEL MANAGEMENT');
    console.log('===========================================================');
    console.log('\n🧹 1. Đang dọn dẹp dữ liệu cũ...');
    await prisma.passwordReset.deleteMany({});
    await prisma.extraServiceOrder.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.roomType.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('   -> Đã làm sạch các bảng dữ liệu.');
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('Admin@123', salt);
    const staffPassword = await bcrypt.hash('Staff@123', salt);
    const custPassword = await bcrypt.hash('Cust@123', salt);
    console.log('\n👥 2. Đang tạo các tài khoản cho từng Role (ADMIN, RECEPTIONIST, CASHIER, CUSTOMER)...');
    const admin1 = await prisma.user.create({
        data: {
            email: 'admin@hotel.com',
            password: adminPassword,
            fullName: 'Nguyễn Văn Quản Trị (Super Admin)',
            phone: '0901112233',
            role: client_1.Role.ADMIN,
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        },
    });
    const admin2 = await prisma.user.create({
        data: {
            email: 'director@hotel.com',
            password: adminPassword,
            fullName: 'Trần Đình Giám Đốc (General Manager)',
            phone: '0902223344',
            role: client_1.Role.ADMIN,
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        },
    });
    const reception1 = await prisma.user.create({
        data: {
            email: 'reception@hotel.com',
            password: staffPassword,
            fullName: 'Lê Thu Hà (Trưởng ca Lễ tân)',
            phone: '0903334455',
            role: client_1.Role.RECEPTIONIST,
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        },
    });
    const reception2 = await prisma.user.create({
        data: {
            email: 'reception.morning@hotel.com',
            password: staffPassword,
            fullName: 'Nguyễn Minh Trang (Lễ tân Ca sáng)',
            phone: '0904445566',
            role: client_1.Role.RECEPTIONIST,
            avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        },
    });
    const reception3 = await prisma.user.create({
        data: {
            email: 'reception.night@hotel.com',
            password: staffPassword,
            fullName: 'Trần Quốc Bảo (Lễ tân Ca đêm)',
            phone: '0905556677',
            role: client_1.Role.RECEPTIONIST,
            avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        },
    });
    const cashier1 = await prisma.user.create({
        data: {
            email: 'cashier@hotel.com',
            password: staffPassword,
            fullName: 'Trần Văn Minh (Thu ngân Quầy sảnh)',
            phone: '0906667788',
            role: client_1.Role.CASHIER,
            avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
        },
    });
    const cashier2 = await prisma.user.create({
        data: {
            email: 'cashier.accounting@hotel.com',
            password: staffPassword,
            fullName: 'Vũ Thị Bích Ngọc (Kế toán Thu chi)',
            phone: '0907778899',
            role: client_1.Role.CASHIER,
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        },
    });
    const customer1 = await prisma.user.create({
        data: {
            email: 'khachhang1@gmail.com',
            password: custPassword,
            fullName: 'Nguyễn Anh Tuấn (Khách VIP Platinum)',
            phone: '0918889900',
            role: client_1.Role.CUSTOMER,
            avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
        },
    });
    const customer2 = await prisma.user.create({
        data: {
            email: 'khachhang2@gmail.com',
            password: custPassword,
            fullName: 'Phạm Thị Mai (Khách Cặp đôi)',
            phone: '0981112244',
            role: client_1.Role.CUSTOMER,
            avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        },
    });
    const customer3 = await prisma.user.create({
        data: {
            email: 'customer.john@gmail.com',
            password: custPassword,
            fullName: 'Johnathan Miller (Khách Quốc tế)',
            phone: '0935558899',
            role: client_1.Role.CUSTOMER,
            avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
        },
    });
    const customer4 = await prisma.user.create({
        data: {
            email: 'customer.hoanglong@gmail.com',
            password: custPassword,
            fullName: 'Hoàng Quốc Long (Khách Gia đình)',
            phone: '0943332211',
            role: client_1.Role.CUSTOMER,
            avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
        },
    });
    const customer5 = await prisma.user.create({
        data: {
            email: 'customer.huonglan@gmail.com',
            password: custPassword,
            fullName: 'Đỗ Hương Lan (Khách Nghỉ dưỡng)',
            phone: '0978887766',
            role: client_1.Role.CUSTOMER,
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        },
    });
    console.log('   -> Đã tạo 12 người dùng phân quyền (2 Admin, 3 Lễ tân, 2 Thu ngân, 5 Khách hàng).');
    console.log('\n🛏️ 3. Đang tạo các loại phòng nghỉ dưỡng...');
    const stdSingle = await prisma.roomType.create({
        data: {
            name: 'Standard Single Room',
            code: 'STD-S',
            description: 'Phòng tiêu chuẩn ấm cúng 1 giường đơn, tối ưu cho khách đi công tác một mình hoặc tiết kiệm chi phí.',
            basePrice: 450000,
            capacityAdults: 1,
            capacityChildren: 0,
            sizeSqM: 20,
            amenities: ['Wifi tốc độ cao', 'Điều hòa 2 chiều', 'Smart TV 40 inch', 'Ấm đun nước siêu tốc', 'Bàn làm việc nhỏ', 'Phòng tắm đứng sen vòi'],
            images: [
                'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=1000&q=80',
            ],
        },
    });
    const stdDouble = await prisma.roomType.create({
        data: {
            name: 'Standard Queen Double',
            code: 'STD-D',
            description: 'Phòng tiêu chuẩn giường Queen êm ái, đầy đủ trang thiết bị hiện đại, thiết kế tinh tế hài hòa.',
            basePrice: 650000,
            capacityAdults: 2,
            capacityChildren: 1,
            sizeSqM: 28,
            amenities: ['Wifi tốc độ cao', 'Điều hòa Inverter', 'Smart TV 43 inch', 'Minibar mini', 'Máy sấy tóc', 'Két sắt bảo mật'],
            images: [
                'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1000&q=80',
            ],
        },
    });
    const supCity = await prisma.roomType.create({
        data: {
            name: 'Superior City View',
            code: 'SUP-CV',
            description: 'Phòng Superior với cửa kính lớn nhìn toàn cảnh thành phố nhộn nhịp, góc đọc sách thư giãn tiện nghi.',
            basePrice: 950000,
            capacityAdults: 2,
            capacityChildren: 1,
            sizeSqM: 35,
            amenities: ['Cửa kính chạm trần view thành phố', 'Bàn trà & ghế đọc sách', 'Smart TV 50 inch 4K', 'Áo choàng tắm & Dép bông', 'Minibar đa dạng'],
            images: [
                'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
            ],
        },
    });
    const dlxOcean = await prisma.roomType.create({
        data: {
            name: 'Deluxe Ocean Panorama',
            code: 'DLX-OV',
            description: 'Phòng Deluxe ban công riêng hướng biển ngoạn mục, bồn tắm nằm cao cấp ngắm hoàng hôn.',
            basePrice: 1450000,
            capacityAdults: 2,
            capacityChildren: 2,
            sizeSqM: 45,
            amenities: ['Ban công riêng view trực diện biển', 'Bồn tắm nằm ngắm biển', 'Máy pha cà phê Nespresso', 'Loa Bluetooth Marshall', 'Đồ vệ sinh L’Occitane cao cấp'],
            images: [
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1000&q=80',
            ],
        },
    });
    const execSuite = await prisma.roomType.create({
        data: {
            name: 'Executive Business Suite',
            code: 'SUI-EXEC',
            description: 'Căn hộ Suite chuẩn thượng lưu với phòng khách và phòng ngủ riêng biệt, phòng làm việc chuyên nghiệp, bồn Jacuzzi.',
            basePrice: 2800000,
            capacityAdults: 3,
            capacityChildren: 2,
            sizeSqM: 75,
            amenities: ['Phòng khách và phòng ngủ riêng biệt', 'Bồn sục Jacuzzi đôi', 'Quầy bar mini tại phòng', 'Đặc quyền Executive Lounge', 'Dịch vụ Butler phục vụ 24/7'],
            images: [
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=80',
            ],
        },
    });
    const presPenthouse = await prisma.roomType.create({
        data: {
            name: 'Presidential Penthouse Suite',
            code: 'PRE-VIP',
            description: 'Đỉnh cao phong cách nghỉ dưỡng tại tầng cao nhất với hồ bơi vô cực mini riêng, phòng ăn 8 người và view 360 độ.',
            basePrice: 5500000,
            capacityAdults: 4,
            capacityChildren: 2,
            sizeSqM: 130,
            amenities: ['Hồ bơi vô cực mini sân thượng riêng', 'Phòng xông hơi Sauna khô & ướt', 'Bếp hiện đại & Bàn tiệc 8 người', 'Rượu vang chào mừng thượng hạng', 'Đưa đón Limousine sân bay 2 chiều'],
            images: [
                'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=1000&q=80',
            ],
        },
    });
    console.log('   -> Đã tạo 6 loại phòng (STD-S, STD-D, SUP-CV, DLX-OV, SUI-EXEC, PRE-VIP).');
    console.log('\n🚪 4. Đang khởi tạo danh sách 20 phòng trải dài các tầng...');
    const roomData = [
        { roomNumber: '101', floor: 1, roomTypeId: stdSingle.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '102', floor: 1, roomTypeId: stdSingle.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '103', floor: 1, roomTypeId: stdDouble.id, status: client_1.RoomStatus.OCCUPIED },
        { roomNumber: '104', floor: 1, roomTypeId: stdDouble.id, status: client_1.RoomStatus.CLEANING, notes: 'Đang dọn dẹp vệ sinh phòng sau khi trả phòng' },
        { roomNumber: '201', floor: 2, roomTypeId: supCity.id, status: client_1.RoomStatus.OCCUPIED },
        { roomNumber: '202', floor: 2, roomTypeId: supCity.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '203', floor: 2, roomTypeId: supCity.id, status: client_1.RoomStatus.RESERVED, notes: 'Khách VIP đã cọc, nhận phòng chiều nay' },
        { roomNumber: '204', floor: 2, roomTypeId: supCity.id, status: client_1.RoomStatus.MAINTENANCE, notes: 'Bảo trì thay vòi nước sen nóng lạnh' },
        { roomNumber: '301', floor: 3, roomTypeId: dlxOcean.id, status: client_1.RoomStatus.OCCUPIED },
        { roomNumber: '302', floor: 3, roomTypeId: dlxOcean.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '303', floor: 3, roomTypeId: dlxOcean.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '304', floor: 3, roomTypeId: dlxOcean.id, status: client_1.RoomStatus.CLEANING, notes: 'Đổi ga trải giường và xịt khử khuẩn' },
        { roomNumber: '401', floor: 4, roomTypeId: execSuite.id, status: client_1.RoomStatus.OCCUPIED },
        { roomNumber: '402', floor: 4, roomTypeId: execSuite.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '403', floor: 4, roomTypeId: execSuite.id, status: client_1.RoomStatus.RESERVED, notes: 'Đoàn công tác đối tác quốc tế' },
        { roomNumber: '404', floor: 4, roomTypeId: execSuite.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '501', floor: 5, roomTypeId: presPenthouse.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '502', floor: 5, roomTypeId: presPenthouse.id, status: client_1.RoomStatus.RESERVED, notes: 'Đặt tiệc sinh nhật cuối tuần' },
    ];
    const createdRooms = {};
    for (const r of roomData) {
        const created = await prisma.room.create({ data: r });
        createdRooms[r.roomNumber] = created;
    }
    console.log(`   -> Đã tạo ${roomData.length} phòng với đầy đủ trạng thái (AVAILABLE, OCCUPIED, RESERVED, CLEANING, MAINTENANCE).`);
    console.log('\n📅 5. Đang tạo các kịch bản đặt phòng (Đang ở, Đã trả phòng, Đã xác nhận, Đang chờ, Đã hủy)...');
    const now = new Date();
    const dAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const dAhead = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const bookingCheckedIn1 = await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-001',
            customerId: customer1.id,
            roomId: createdRooms['301'].id,
            checkInDate: dAgo(1),
            checkOutDate: dAhead(2),
            actualCheckIn: dAgo(1),
            guestCount: 2,
            totalAmount: 4350000,
            depositAmount: 2000000,
            status: client_1.BookingStatus.CHECKED_IN,
            specialRequests: 'Kỷ niệm ngày cưới, setup hoa hồng và bánh kem chúc mừng',
        },
    });
    const bookingCheckedIn2 = await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-002',
            customerId: customer3.id,
            roomId: createdRooms['401'].id,
            checkInDate: dAgo(2),
            checkOutDate: dAhead(1),
            actualCheckIn: dAgo(2),
            guestCount: 2,
            totalAmount: 8400000,
            depositAmount: 4000000,
            status: client_1.BookingStatus.CHECKED_IN,
            specialRequests: 'Cần dịch vụ đưa đón sân bay và hóa đơn VAT cho công ty',
        },
    });
    const bookingCheckedOut = await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-003',
            customerId: customer2.id,
            roomId: createdRooms['101'].id,
            checkInDate: dAgo(6),
            checkOutDate: dAgo(3),
            actualCheckIn: dAgo(6),
            actualCheckOut: dAgo(3),
            guestCount: 1,
            totalAmount: 1350000,
            depositAmount: 500000,
            status: client_1.BookingStatus.CHECKED_OUT,
        },
    });
    const bookingConfirmed = await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-004',
            customerId: customer4.id,
            roomId: createdRooms['203'].id,
            checkInDate: dAhead(1),
            checkOutDate: dAhead(4),
            guestCount: 3,
            totalAmount: 2850000,
            depositAmount: 1000000,
            status: client_1.BookingStatus.CONFIRMED,
            specialRequests: 'Gia đình có bé nhỏ 3 tuổi, cần nôi em bé và phòng không mùi thuốc lá',
        },
    });
    const bookingPending = await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-005',
            customerId: customer5.id,
            roomId: createdRooms['501'].id,
            checkInDate: dAhead(5),
            checkOutDate: dAhead(7),
            guestCount: 2,
            totalAmount: 11000000,
            depositAmount: 0,
            status: client_1.BookingStatus.PENDING,
            specialRequests: 'Đặt tiệc tối lãng mạn cạnh hồ bơi',
        },
    });
    const bookingCancelled = await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-006',
            customerId: customer2.id,
            roomId: createdRooms['102'].id,
            checkInDate: dAgo(10),
            checkOutDate: dAgo(8),
            guestCount: 1,
            totalAmount: 900000,
            depositAmount: 0,
            status: client_1.BookingStatus.CANCELLED,
            specialRequests: 'Bận chuyến bay đột xuất nên xin phép hủy phòng',
        },
    });
    console.log('   -> Đã tạo 6 đơn đặt phòng với đầy đủ các trạng thái vận hành thực tế.');
    console.log('\n🍷 6. Đang thêm các dịch vụ phát sinh (Minibar, Nhà hàng, Đưa đón sân bay, Spa)...');
    await prisma.extraServiceOrder.createMany({
        data: [
            {
                bookingId: bookingCheckedIn1.id,
                serviceName: 'Rượu vang đỏ Chile cao cấp (Chai 750ml)',
                unitPrice: 650000,
                quantity: 1,
                totalPrice: 650000,
            },
            {
                bookingId: bookingCheckedIn1.id,
                serviceName: 'Bia Heineken lon 330ml',
                unitPrice: 45000,
                quantity: 4,
                totalPrice: 180000,
            },
            {
                bookingId: bookingCheckedIn1.id,
                serviceName: 'Liệu trình Massage & Spa Trị liệu Cặp đôi (90 phút)',
                unitPrice: 900000,
                quantity: 1,
                totalPrice: 900000,
            },
            {
                bookingId: bookingCheckedIn2.id,
                serviceName: 'Dịch vụ xe Limousine đưa đón sân bay 2 chiều',
                unitPrice: 800000,
                quantity: 1,
                totalPrice: 800000,
            },
            {
                bookingId: bookingCheckedIn2.id,
                serviceName: 'Buffet sáng quốc tế phục vụ tại phòng',
                unitPrice: 250000,
                quantity: 2,
                totalPrice: 500000,
            },
            {
                bookingId: bookingCheckedIn2.id,
                serviceName: 'Giặt ủi đồ vest công sở hỏa tốc',
                unitPrice: 150000,
                quantity: 2,
                totalPrice: 300000,
            },
            {
                bookingId: bookingCheckedOut.id,
                serviceName: 'Nước suối khoáng Evian 500ml',
                unitPrice: 40000,
                quantity: 2,
                totalPrice: 80000,
            },
            {
                bookingId: bookingCheckedOut.id,
                serviceName: 'Hạt điều rang muối thượng hạng',
                unitPrice: 60000,
                quantity: 1,
                totalPrice: 60000,
            },
        ],
    });
    console.log('   -> Đã tạo 8 hóa đơn chi tiết dịch vụ minibar, ăn uống, spa và di chuyển.');
    console.log('\n🧾 7. Đang tạo các hóa đơn thanh toán tương ứng...');
    await prisma.invoice.create({
        data: {
            invoiceCode: 'INV-2026-001',
            bookingId: bookingCheckedOut.id,
            roomAmount: 1350000,
            servicesAmount: 140000,
            discount: 50000,
            tax: 144000,
            finalAmount: 1584000,
            paidAmount: 1584000,
            paymentMethod: client_1.PaymentMethod.CREDIT_CARD,
            paymentStatus: client_1.PaymentStatus.PAID,
            issuedById: cashier1.id,
            paidAt: dAgo(3),
            notes: 'Khách thanh toán qua thẻ Visa contactless tại quầy thu ngân',
        },
    });
    await prisma.invoice.create({
        data: {
            invoiceCode: 'INV-2026-002',
            bookingId: bookingCheckedIn1.id,
            roomAmount: 4350000,
            servicesAmount: 1730000,
            discount: 200000,
            tax: 588000,
            finalAmount: 6468000,
            paidAmount: 2000000,
            paymentMethod: client_1.PaymentMethod.BANK_TRANSFER,
            paymentStatus: client_1.PaymentStatus.PARTIAL,
            issuedById: cashier2.id,
            notes: 'Khách đã cọc 2.000.000 VND chuyển khoản Vietcombank khi check-in, phần còn lại thanh toán khi check-out',
        },
    });
    await prisma.invoice.create({
        data: {
            invoiceCode: 'INV-2026-003',
            bookingId: bookingConfirmed.id,
            roomAmount: 2850000,
            servicesAmount: 0,
            discount: 0,
            tax: 285000,
            finalAmount: 3135000,
            paidAmount: 1000000,
            paymentMethod: client_1.PaymentMethod.BANK_TRANSFER,
            paymentStatus: client_1.PaymentStatus.PARTIAL,
            issuedById: cashier1.id,
            notes: 'Tiền cọc giữ phòng chuyển khoản qua cổng thanh toán QR Code',
        },
    });
    console.log('   -> Đã tạo 3 hóa đơn tương ứng các trạng thái PAID, PARTIAL với chi tiết VAT, chiết khấu.');
    console.log('\n🔑 8. Đang tạo mã OTP test quên mật khẩu...');
    await prisma.passwordReset.create({
        data: {
            email: 'khachhang1@gmail.com',
            otp: '123456',
            token: 'demo-reset-token-for-testing-2026',
            expiresAt: dAhead(1),
            used: false,
        },
    });
    console.log('   -> Đã gán OTP 123456 hợp lệ cho khachhang1@gmail.com.');
    console.log('\n===========================================================');
    console.log('🎉 KHỞI TẠO VÀ FAKE DỮ LIỆU CƠ SỞ DỮ LIỆU HOÀN TẤT!');
    console.log('===========================================================');
    console.log('\n📋 DANH SÁCH TÀI KHOẢN THEO TỪNG ROLE ĐỂ ĐĂNG NHẬP:');
    console.log('-----------------------------------------------------------');
    console.log('👑 [ADMIN]:');
    console.log('   - Email: admin@hotel.com            | Pass: Admin@123  (Super Admin)');
    console.log('   - Email: director@hotel.com         | Pass: Admin@123  (Tổng giám đốc)');
    console.log('');
    console.log('🛎️ [RECEPTIONIST - LỄ TÂN]:');
    console.log('   - Email: reception@hotel.com        | Pass: Staff@123  (Trưởng ca lễ tân)');
    console.log('   - Email: reception.morning@hotel.com| Pass: Staff@123  (Ca sáng)');
    console.log('   - Email: reception.night@hotel.com  | Pass: Staff@123  (Ca đêm)');
    console.log('');
    console.log('💳 [CASHIER - THU NGÂN]:');
    console.log('   - Email: cashier@hotel.com          | Pass: Staff@123  (Thu ngân sảnh)');
    console.log('   - Email: cashier.accounting@hotel.com| Pass: Staff@123 (Kế toán thu chi)');
    console.log('');
    console.log('👤 [CUSTOMER - KHÁCH HÀNG]:');
    console.log('   - Email: khachhang1@gmail.com       | Pass: Cust@123   (Khách VIP)');
    console.log('   - Email: khachhang2@gmail.com       | Pass: Cust@123   (Khách cặp đôi)');
    console.log('   - Email: customer.john@gmail.com    | Pass: Cust@123   (Khách quốc tế)');
    console.log('   - Email: customer.hoanglong@gmail.com| Pass: Cust@123  (Khách gia đình)');
    console.log('   - Email: customer.huonglan@gmail.com| Pass: Cust@123   (Khách nghỉ dưỡng)');
    console.log('-----------------------------------------------------------');
}
main()
    .catch((e) => {
    console.error('❌ Lỗi khi khởi tạo dữ liệu mẫu:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map