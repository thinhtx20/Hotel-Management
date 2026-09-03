# Hợp đồng API chuẩn hóa — Hệ thống Khách sạn Luxe Grand

Tài liệu này giải đáp chi tiết 10 câu hỏi quy ước (Mục 07) và tổng hợp tất cả các endpoint đã được hoàn thiện trên backend NestJS theo tài liệu rà soát [Khoảng Trống API Luxe Grand](https://claude.ai/code/artifact/a9723aad-ae9e-4d6a-b702-970e9b965190).

---

## 1. Giải đáp 10 câu hỏi chốt hợp đồng (Mục 07)

### 1. Enum trạng thái đơn (`BookingStatus`)
Bộ trạng thái chính thức:
- `PENDING`: Đơn mới tạo, chờ lễ tân hoặc quản trị viên duyệt.
- `CONFIRMED`: Đã xác nhận giữ phòng (sau khi duyệt hoặc đặt cọc thành công).
- `CHECKED_IN`: Khách đã nhận phòng, đang lưu trú.
- `CHECKED_OUT`: Khách đã hoàn tất trả phòng và thanh toán hóa đơn.
- `CANCELLED`: Đơn đã bị hủy trước khi nhận phòng (phòng được tự động giải phóng).

### 2. Enum trạng thái phòng (`RoomStatus`)
Bộ 5 trạng thái phòng chuẩn (khớp hoàn toàn với bảng màu 5 trạng thái trên app):
- `AVAILABLE` (Xanh ngọc): Phòng trống, sạch sẽ, sẵn sàng đón khách.
- `OCCUPIED` (Xanh hoàng gia): Phòng đang có khách lưu trú.
- `RESERVED` (Cam hổ phách): Phòng đã được khách đặt cọc giữ chỗ.
- `CLEANING` (Xám tro): Phòng đang được dọn dẹp sau khi khách check-out.
- `MAINTENANCE` (Đỏ gạch): Phòng đang bảo trì kỹ thuật, tạm khóa đặt.

### 3. Enum trạng thái thanh toán (`PaymentStatus`)
- `UNPAID`: Chưa thanh toán.
- `PARTIAL`: Đã thanh toán một phần (đặt cọc).
- `PAID`: Đã thanh toán đủ toàn bộ số tiền hóa đơn.
- `REFUNDED`: Đã hoàn tiền cho khách (khi hủy đơn hợp lệ).

### 4. Enum phương thức thanh toán (`PaymentMethod`)
- `CASH`: Tiền mặt tại quầy.
- `CREDIT_CARD`: Thẻ tín dụng / ghi nợ qua máy POS.
- `BANK_TRANSFER`: Chuyển khoản ngân hàng (hỗ trợ hiển thị mã VietQR).

### 5. Nghiệp vụ thanh toán `POST /invoices/:id/pay`
Client gửi payload:
```json
{
  "amount": 1500000,
  "paymentMethod": "CASH",
  "notes": "Khách trả đợt 1 tại quầy"
}
```
**Quy tắc:** Backend **tự động tính toán** `newPaidAmount = invoice.paidAmount + amount` và tự động cập nhật `paymentStatus` sang `PAID` (nếu đủ hoặc thừa) hoặc `PARTIAL` (nếu chưa đủ). Client **không cần** tự tính toán `paymentStatus`.

### 6. Định dạng Ngày Giờ
- Sử dụng chuẩn **ISO 8601** kèm múi giờ UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`) hoặc offset địa phương `+07:00`.
- Khuyến nghị FE sử dụng `DateTime.parse(str).toLocal()` để hiển thị chính xác theo giờ Việt Nam.

### 7. Định dạng Tiền Tệ
- Sử dụng số nguyên **VND** (kiểu `number`, không có số lẻ thập phân).
- Ví dụ: `1500000` thay vì `"1.500.000"` hay `1500000.00`.

### 8. Bảo mật `POST /auth/register`
- Backend **bỏ qua** trường `role` nếu client gửi lên và **ép cứng** quyền `CUSTOMER` tại server.
- Việc cấp quyền `ADMIN`, `RECEPTIONIST`, `CASHIER` chỉ thực hiện qua tài khoản quản trị viên tại `PATCH /api/v1/users/:id`.

### 9. Cơ chế xoay vòng Refresh Token (Token Rotation)
- Mỗi lần gọi `POST /auth/refresh-token`, backend sẽ thu hồi refresh token cũ trong Redis và cấp lại **cặp token mới** (`accessToken` + `refreshToken`).
- Cả hai token mới được trả về cùng lúc trong payload:
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { ... }
  }
}
```

### 10. Thời hạn sống của Token
- **Access Token:** 15 phút (900 giây).
- **Refresh Token:** 7 ngày (604,800 giây).
- Khách sạn hỗ trợ chủ động refresh token trước khi access token hết hạn để trải nghiệm không bị gián đoạn.

---

## 2. Tổng hợp các Endpoint & Payload mới bổ sung

### A. Analytics Dashboard (`GET /api/v1/analytics/dashboard`)
Đầy đủ 10/10 số liệu phẳng + chuỗi 7 ngày:
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "totalRevenueToday": 128500000,
    "todayRevenue": 128500000,
    "yesterdayRevenue": 114300000,
    "revenueChangePercent": 12.4,
    "occupancyRate": 70.0,
    "totalRooms": 20,
    "availableRooms": 6,
    "occupiedRooms": 14,
    "reservedRooms": 0,
    "cleaningRooms": 0,
    "maintenanceRooms": 0,
    "checkInsToday": 3,
    "todayCheckIns": 3,
    "checkOutsToday": 2,
    "todayCheckOuts": 2,
    "activeBookings": 9,
    "pendingBookings": 4,
    "pendingInvoicesCount": 3,
    "unpaidInvoices": 3,
    "roomStatusBreakdown": {
      "AVAILABLE": 6,
      "OCCUPIED": 14,
      "RESERVED": 0,
      "CLEANING": 0,
      "MAINTENANCE": 0
    },
    "revenue7Days": [
      { "date": "2026-08-28", "label": "T5", "amount": 96200000, "invoiceCount": 4 },
      { "date": "2026-08-29", "label": "T6", "amount": 112400000, "invoiceCount": 6 },
      { "date": "2026-08-30", "label": "T7", "amount": 135000000, "invoiceCount": 7 },
      { "date": "2026-08-31", "label": "CN", "amount": 148000000, "invoiceCount": 8 },
      { "date": "2026-09-01", "label": "T2", "amount": 105000000, "invoiceCount": 5 },
      { "date": "2026-09-02", "label": "T3", "amount": 141900000, "invoiceCount": 7 },
      { "date": "2026-09-03", "label": "T4", "amount": 128500000, "invoiceCount": 6 }
    ]
  }
}
```

### B. Danh mục dịch vụ (`GET /api/v1/services`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": "svc-001",
      "code": "LAUNDRY",
      "name": "Giặt là cao cấp",
      "category": "CONVENIENCE",
      "description": "Giặt ủi quần áo lấy trong ngày, đóng gói cẩn thận",
      "unitPrice": 50000,
      "unit": "món",
      "icon": "local_laundry_service",
      "isAvailable": true
    },
    {
      "id": "svc-002",
      "code": "MINIBAR",
      "name": "Minibar trọn gói",
      "category": "FOOD_BEVERAGE",
      "description": "Bao gồm snack cao cấp, nước ngọt, bia và nước khoáng hảo hạng",
      "unitPrice": 150000,
      "unit": "combo",
      "icon": "kitchen",
      "isAvailable": true
    },
    {
      "id": "svc-003",
      "code": "BREAKFAST",
      "name": "Ăn sáng buffet tại phòng",
      "category": "FOOD_BEVERAGE",
      "description": "Phục vụ bữa sáng tiêu chuẩn 5 sao tận phòng ngủ theo yêu cầu",
      "unitPrice": 200000,
      "unit": "suất",
      "icon": "restaurant",
      "isAvailable": true
    }
  ]
}
```

### C. Báo cáo doanh thu thu ngân (`GET /api/v1/invoices/summary?date=today`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "date": "2026-09-03",
    "todayRevenue": 128500000,
    "totalInvoices": 18,
    "paidInvoices": 14,
    "unpaidInvoices": 3,
    "partialInvoices": 1
  }
}
```

### D. Thông tin cá nhân (`GET /api/v1/auth/me`)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": "uuid-123",
    "email": "customer@hotel.com",
    "fullName": "Nguyễn Văn Khách",
    "phone": "0912345678",
    "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "2026-09-03T07:00:00.000Z",
    "stats": {
      "totalBookings": 12,
      "activeBookings": 2,
      "averageRating": 5.0
    }
  }
}
```

### E. Cập nhật hồ sơ cá nhân (`PATCH /api/v1/users/me`)
```json
// Request Body
{
  "fullName": "Nguyễn Văn Khách Hàng VIP",
  "phone": "0988776655",
  "avatar": "https://images.unsplash.com/photo-..."
}
```

### F. Đổi mật khẩu (`POST /api/v1/auth/change-password`)
```json
// Request Body
{
  "oldPassword": "CurrentPassword@123",
  "newPassword": "NewPassword@2026"
}
```

### G. Sơ đồ phòng (`GET /api/v1/rooms`)
Mỗi phòng khi có khách (`OCCUPIED`) sẽ tự động có thêm `currentBooking`:
```json
{
  "id": "room-uuid",
  "roomNumber": "101",
  "floor": 1,
  "status": "OCCUPIED",
  "pricePerNight": 1200000,
  "images": ["https://images.unsplash.com/..."],
  "amenities": ["Wifi miễn phí", "Điều hòa hai chiều", "Bể bơi"],
  "capacity": 3,
  "area": 35,
  "rating": 4.9,
  "reviewCount": 48,
  "currentBooking": {
    "id": "booking-uuid",
    "bookingCode": "BK-240901",
    "guestName": "Trần Văn A",
    "guestPhone": "0901234567",
    "checkOutDate": "2026-09-05T12:00:00.000Z"
  }
}
```

### H. Check-out phòng (`POST /api/v1/bookings/:id/check-out`)
Trả trực tiếp `invoiceId` ở cấp ngoài cùng để client chuyển thẳng sang màn hình thu ngân:
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "message": "Check-out và thanh toán hóa đơn thành công",
    "invoiceId": "inv-uuid-789",
    "booking": { ... },
    "invoice": { ... }
  }
}
```
