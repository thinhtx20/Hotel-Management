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
            email: 'customer@hotel.com',
            password: custPassword,
            fullName: 'Nguyễn Anh Tuấn (Khách VIP Platinum)',
            phone: '0918889900',
            role: client_1.Role.CUSTOMER,
            avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
        },
    });
    const customerOld1 = await prisma.user.create({
        data: {
            email: 'khachhang1@gmail.com',
            password: custPassword,
            fullName: 'Phạm Văn Hùng (Khách Thân thiết)',
            phone: '0918889911',
            role: client_1.Role.CUSTOMER,
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
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
    console.log('\n🛏️ 3. Đang tạo các loại phòng nghỉ dưỡng cao cấp với dữ liệu chi tiết...');
    const stdSingle = await prisma.roomType.create({
        data: {
            name: 'Standard Single Room',
            code: 'STD-S',
            description: 'Phòng tiêu chuẩn đơn hiện đại được thiết kế tối ưu cho khách đi công tác hoặc du lịch cá nhân. Không gian thoáng đãng, yên tĩnh, bài trí bàn làm việc công thái học tiện nghi cùng giường đơn êm ái, đảm bảo giấc ngủ sâu tái tạo năng lượng sau một ngày làm việc hiệu quả.',
            basePrice: 450000,
            capacityAdults: 1,
            capacityChildren: 0,
            sizeSqM: 22,
            amenities: [
                'Wifi 6 tốc độ cao 300Mbps',
                'Điều hòa nhiệt độ 2 chiều Inverter',
                'Smart TV 40 inch tích hợp Youtube',
                'Bàn làm việc & ghế công thái học',
                'Phòng tắm đứng kính cường lực',
                'Vòi sen áp lực cao nóng lạnh',
                'Ấm đun nước siêu tốc',
                'Két an toàn điện tử',
                'Máy sấy tóc công suất lớn',
                'Tủ quần áo & móc treo đồ gỗ',
                'Khăn tắm dệt sợi bông & Dép đi trong nhà',
                'Nước khoáng & Trà túi lọc miễn phí',
            ],
            images: [
                'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });
    const stdDouble = await prisma.roomType.create({
        data: {
            name: 'Standard Queen Double',
            code: 'STD-D',
            description: 'Phòng Standard Queen Double mang phong cách trang nhã ấm cúng với tông màu gỗ sáng và ánh sáng tự nhiên ngập tràn. Trang bị giường Queen size nệm cao su non nhập khẩu êm ái, TV giải trí 43 inch cùng minibar đồ uống mát lạnh, mang đến trải nghiệm nghỉ ngơi thư thái tối đa cho các cặp đôi hoặc gia đình nhỏ.',
            basePrice: 650000,
            capacityAdults: 2,
            capacityChildren: 1,
            sizeSqM: 28,
            amenities: [
                'Giường Queen Size (1.6m x 2.0m)',
                'Wifi 6 không dây tốc độ cao',
                'Điều hòa âm trần làm lạnh nhanh',
                'Smart TV 43 inch Full HD có Netflix',
                'Minibar đa dạng nước giải khát & bia',
                'Két sắt bảo mật mã số cá nhân',
                'Máy sấy tóc & Gương soi đèn LED',
                'Phòng tắm kính vòi sen tắm mưa',
                'Áo choàng tắm sợi bông & Dép nỉ êm',
                'Bộ đồ vệ sinh cá nhân cao cấp',
                'Ấm đun nước & Trà/Cà phê miễn phí',
                'Dịch vụ dọn phòng chuyên nghiệp hàng ngày',
            ],
            images: [
                'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });
    const supCity = await prisma.roomType.create({
        data: {
            name: 'Superior City View',
            code: 'SUP-CV',
            description: 'Sở hữu ô cửa kính tràn viền chạm trần hướng ra đại lộ phồn hoa, Superior City View là nơi ngắm trọn vẹn nhịp sống năng động ban ngày và biển ánh sáng lung linh của thành phố về đêm. Không gian rộng rãi 35m² với khu vực bàn trà đọc sách thư giãn, giường ngủ King lớn chuẩn 5 sao và bữa sáng buffet thượng hạng miễn phí mỗi ngày.',
            basePrice: 950000,
            capacityAdults: 2,
            capacityChildren: 1,
            sizeSqM: 35,
            amenities: [
                'Cửa kính tràn viền chạm trần City View',
                'Giường King đôi lớn (1.8m x 2.0m)',
                'Bao gồm bữa sáng Buffet Á - Âu miễn phí',
                'Bàn trà & Ghế đọc sách Armchair êm ái',
                'Smart TV 50 inch 4K Ultra HD',
                'Phòng tắm ốp đá hoa cương sang trọng',
                'Bộ dầu gội & sữa tắm thảo dược tự nhiên',
                'Áo choàng tắm dệt lụa cao cấp',
                'Hệ thống rèm cửa cản sáng 100%',
                'Wifi 6 tốc độ cao không giới hạn',
                'Điều hòa nhiệt độ 2 chiều cảm ứng',
                'Minibar tủ lạnh cao cấp đầy đủ snack',
                'Két an toàn điện tử cỡ lớn',
                'Dịch vụ giặt ủi lấy nhanh trong 4 giờ',
            ],
            images: [
                'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });
    const dlxOcean = await prisma.roomType.create({
        data: {
            name: 'Deluxe Ocean Panorama',
            code: 'DLX-OV',
            description: 'Tận hưởng kỳ nghỉ dưỡng thiên đường tại Deluxe Ocean Panorama với ban công riêng lộng gió mở ra tầm nhìn 180 độ ôm trọn biển xanh ngọc bích. Nổi bật với bồn tắm ngâm sâu đặt ngay cạnh cửa sổ lớn hướng biển để bạn vừa thưởng thức rượu vang vừa ngắm hoàng hôn rực rỡ. Đệm lò xo túi lông vũ siêu êm ái, máy pha cà phê Nespresso và loa Marshall đỉnh cao tạo nên kỳ nghỉ hoàn hảo.',
            basePrice: 1450000,
            capacityAdults: 2,
            capacityChildren: 2,
            sizeSqM: 45,
            amenities: [
                'Ban công riêng 12m² view trực diện biển',
                'Bồn tắm nằm ngắm biển thư giãn với muối khoáng',
                'Giường ngủ King đôi siêu lớn đệm lông vũ',
                'Máy pha cà phê Nespresso viên nén cao cấp',
                'Loa Bluetooth Marshall Acton nghe nhạc sống động',
                'Mỹ phẩm phòng tắm cao cấp L’Occitane (Pháp)',
                'Smart TV 55 inch 4K HDR có sẵn Netflix',
                'Bữa sáng buffet 5 sao phục vụ tại phòng ngủ',
                'Rượu vang chào mừng và trái cây tươi theo mùa',
                'Phòng tắm kính vòi sen trần Rain Shower',
                'Áo choàng tắm dệt sợi waffle siêu mềm mịn',
                'Điều hòa âm trần inverter lọc không khí Nanoe',
                'Hệ thống đèn ngủ ambient light tùy chỉnh cảm xúc',
                'Minibar miễn phí nước suối, trà & cà phê hảo hạng',
                'Dịch vụ dọn phòng 2 lần/ngày kèm mở giường buổi tối',
            ],
            images: [
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });
    const execSuite = await prisma.roomType.create({
        data: {
            name: 'Executive Business Suite',
            code: 'SUI-EXEC',
            description: 'Được thiết kế theo tiêu chuẩn căn hộ hoàng gia thượng lưu rộng 75m², Executive Business Suite tách biệt hoàn toàn giữa phòng khách tiếp đón sang trọng và phòng ngủ riêng tư ấm cúng. Điểm nhấn là bồn sục Jacuzzi massage thủy lực đôi, phòng làm việc riêng với đường truyền cáp quang bảo mật, cùng đặc quyền sử dụng Executive Lounge và dịch vụ Quản gia (Butler) phục vụ riêng 24/7.',
            basePrice: 2800000,
            capacityAdults: 3,
            capacityChildren: 2,
            sizeSqM: 75,
            amenities: [
                'Diện tích 75m² gồm phòng khách & phòng ngủ riêng',
                'Bồn sục Jacuzzi đôi massage thủy lực thư giãn',
                'Đặc quyền Executive Lounge & Tiệc trà chiều thượng hạng',
                'Dịch vụ Quản gia riêng (Butler Service) 24/7',
                'Phòng xông hơi ướt cao cấp ngay trong phòng tắm',
                'Hệ thống 2 Smart TV 65 inch & 55 inch 4K Ultra HD',
                'Dàn âm thanh vòm sống động xem phim chuẩn rạp',
                'Bàn làm việc thương gia & máy in không dây',
                'Quầy bar mini tại phòng & Tủ rượu vang bảo quản nhiệt độ',
                'Bộ sản phẩm vệ sinh hoàng gia Molton Brown (London)',
                'Bữa sáng thượng hạng phục vụ tận giường theo yêu cầu',
                'Miễn phí giặt là 3 món đồ mỗi ngày',
                'Tủ quần áo walk-in closet rộng rãi',
                'Hệ thống điều khiển điện tử Smart Home 1 chạm',
                'Check-in & Check-out ưu tiên tại Executive Lounge',
                'Miễn phí hủy phòng linh hoạt trước 12 giờ',
            ],
            images: [
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });
    const presPenthouse = await prisma.roomType.create({
        data: {
            name: 'Presidential Penthouse Suite',
            code: 'PRE-VIP',
            description: 'Đỉnh cao của sự xa hoa và riêng tư tuyệt đối, Presidential Penthouse Suite tọa lạc tại tầng cao nhất của khách sạn với diện tích 130m² cùng ban công sân thượng bao quanh mang lại tầm nhìn 360 độ ngắm toàn cảnh biển và đường chân trời thành phố. Căn Penthouse sở hữu hồ bơi vô cực mini riêng biệt, phòng xông hơi đá muối Himalaya, bàn tiệc 8 người có đầu bếp riêng phục vụ và dịch vụ đưa đón xe sang Limousine 2 chiều.',
            basePrice: 5500000,
            capacityAdults: 4,
            capacityChildren: 2,
            sizeSqM: 130,
            amenities: [
                'Hồ bơi vô cực mini sân thượng riêng tư trên tầng 5',
                'Phòng xông hơi khô Sauna & Đá muối Himalaya',
                '2 Phòng ngủ Master King siêu sang với đệm lông ngỗng',
                'Phòng ăn lớn 8 người với đầy đủ dụng cụ bếp cao cấp',
                'Đầu bếp riêng phục vụ tiệc nướng BBQ/Âu tại sân thượng',
                'Đưa đón sân bay 2 chiều bằng xe Limousine hạng sang',
                'Smart TV 75 inch 8K OLED & Dàn âm thanh Bang & Olufsen',
                'Bộ mỹ phẩm phòng tắm danh giá Hermès Paris',
                'Hầm rượu vang thượng hạng cá nhân có sẵn chai Champagne Pháp',
                'Quản gia riêng (Private Butler) túc trực phục vụ riêng biệt',
                'Check-in & Check-out bảo mật trực tiếp tại căn hộ',
                'Miễn phí sử dụng trọn gói toàn bộ dịch vụ Spa & Massage',
                'Hệ thống Smart Home điều khiển toàn diện bằng iPad',
                'Bồn tắm tạo bọt mạ vàng ngắm hoàng hôn biển',
                'Phòng thử đồ thời trang walk-in closet siêu rộng',
                'Miễn phí đồ uống minibar và hoa tươi trang trí mỗi ngày',
                'Bãi đỗ xe VIP riêng biệt có nhân viên đỗ xe chuyên nghiệp',
                'Chính sách bảo mật danh tính khách VIP tuyệt đối',
            ],
            images: [
                'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
            ],
        },
    });
    console.log('   -> Đã tạo 6 loại phòng đẳng cấp (STD-S, STD-D, SUP-CV, DLX-OV, SUI-EXEC, PRE-VIP) với đầy đủ ảnh HD và tiện nghi.');
    console.log('\n🚪 4. Đang khởi tạo danh sách 20 phòng trải dài các tầng...');
    const roomData = [
        { roomNumber: '101', floor: 1, roomTypeId: stdSingle.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '102', floor: 1, roomTypeId: stdSingle.id, status: client_1.RoomStatus.AVAILABLE },
        { roomNumber: '103', floor: 1, roomTypeId: stdDouble.id, status: client_1.RoomStatus.OCCUPIED },
        { roomNumber: '104', floor: 1, roomTypeId: stdDouble.id, status: client_1.RoomStatus.CLEANING, notes: 'Đang dọn dẹp vệ sinh phòng sau khi trả phòng' },
        { roomNumber: '201', floor: 2, roomTypeId: supCity.id, status: client_1.RoomStatus.AVAILABLE },
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
        { roomNumber: '502', floor: 5, roomTypeId: presPenthouse.id, status: client_1.RoomStatus.AVAILABLE },
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
            confirmedAt: dAgo(1),
            confirmedById: reception1.id,
            confirmationNote: 'Khách đã chuyển khoản cọc 1.000.000đ, giữ phòng 203',
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
            cancellationReason: 'Khách bận chuyến bay công tác đột xuất nên xin phép hủy phòng',
            cancelledAt: dAgo(11),
            cancelledById: customer2.id,
            specialRequests: 'Bận chuyến bay đột xuất nên xin phép hủy phòng',
        },
    });
    await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-007',
            customerId: customerOld1.id,
            roomId: createdRooms['103'].id,
            checkInDate: dAgo(1),
            checkOutDate: dAhead(1),
            actualCheckIn: dAgo(1),
            guestCount: 2,
            totalAmount: 1300000,
            depositAmount: 500000,
            status: client_1.BookingStatus.CHECKED_IN,
            confirmedAt: dAgo(3),
            confirmedById: reception2.id,
            specialRequests: 'Xin thêm một gối ôm và nước suối miễn phí',
        },
    });
    await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-008',
            customerId: customer3.id,
            roomId: createdRooms['402'].id,
            checkInDate: dAhead(2),
            checkOutDate: dAhead(5),
            guestCount: 2,
            totalAmount: 8400000,
            depositAmount: 0,
            status: client_1.BookingStatus.PENDING,
            specialRequests: 'Cần hóa đơn VAT xuất cho công ty và đưa đón sân bay chiều đến',
        },
    });
    await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-009',
            customerId: customer2.id,
            roomId: createdRooms['302'].id,
            checkInDate: dAhead(1),
            checkOutDate: dAhead(3),
            guestCount: 2,
            totalAmount: 2900000,
            depositAmount: 0,
            status: client_1.BookingStatus.PENDING,
            specialRequests: 'Kỷ niệm ngày cưới, mong được xếp phòng có ban công hướng biển',
        },
    });
    await prisma.booking.create({
        data: {
            bookingCode: 'BK-2026-010',
            customerId: customer4.id,
            roomId: createdRooms['403'].id,
            checkInDate: dAhead(3),
            checkOutDate: dAhead(6),
            guestCount: 3,
            totalAmount: 8400000,
            depositAmount: 3000000,
            status: client_1.BookingStatus.CONFIRMED,
            confirmedAt: dAgo(2),
            confirmedById: reception3.id,
            confirmationNote: 'Đoàn công tác đối tác quốc tế, đã cọc 3.000.000đ',
            specialRequests: 'Đoàn công tác 3 người, cần phòng họp nhỏ vào buổi sáng',
        },
    });
    console.log('   -> Đã tạo 10 đơn đặt phòng: 3 PENDING (chờ xác nhận), 2 CONFIRMED, 3 CHECKED_IN, 1 CHECKED_OUT, 1 CANCELLED có lý do hủy.');
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