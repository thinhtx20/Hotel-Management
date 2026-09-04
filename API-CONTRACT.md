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
      { "date": "2026-08-28", "label": "T5", "dateLabel": "28/08", "amount": 96200000, "revenue": 96200000, "invoiceCount": 4 },
      { "date": "2026-08-29", "label": "T6", "dateLabel": "29/08", "amount": 112400000, "revenue": 112400000, "invoiceCount": 6 },
      { "date": "2026-08-30", "label": "T7", "dateLabel": "30/08", "amount": 135000000, "revenue": 135000000, "invoiceCount": 7 },
      { "date": "2026-08-31", "label": "CN", "dateLabel": "31/08", "amount": 148000000, "revenue": 148000000, "invoiceCount": 8 },
      { "date": "2026-09-01", "label": "T2", "dateLabel": "01/09", "amount": 105000000, "revenue": 105000000, "invoiceCount": 5 },
      { "date": "2026-09-02", "label": "T3", "dateLabel": "02/09", "amount": 141900000, "revenue": 141900000, "invoiceCount": 7 },
      { "date": "2026-09-03", "label": "T4", "dateLabel": "03/09", "amount": 128500000, "revenue": 128500000, "invoiceCount": 6 }
    ],
    "availableRanges": [1, 7, 14, 30],
    "revenueRanges": { "1": { "...": "" }, "7": { "...": "" }, "14": { "...": "" }, "30": { "...": "" } }
  }
}
```

`revenueRanges` là đúng khối `ranges` của `GET /analytics/revenue/daily` bên dưới — dashboard nhúng sẵn để FE dựng 4 chip lọc mà không phải gọi thêm API.

### A2. Doanh thu theo ngày, 4 khoảng (`GET /api/v1/analytics/revenue/daily?range=7`)

Quyền: `ADMIN`, `RECEPTIONIST`, `CASHIER`.

Tham số `range` nhận **1 / 7 / 14 / 30** (mặc định `7`). `days` vẫn dùng được như alias cũ.
Một lần gọi trả về **cả 4 khoảng** trong `ranges`, nên bấm chip lọc là đổi được ngay ở client.
Các field `series` / `total` / `average` / `peak` ở cấp ngoài ứng với khoảng đang chọn.

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "range": 7,
    "days": 7,
    "availableRanges": [1, 7, 14, 30],
    "from": "2026-08-28",
    "to": "2026-09-03",
    "series": [
      { "date": "2026-09-03", "label": "T4", "dateLabel": "03/09", "revenue": 128500000, "amount": 128500000, "invoiceCount": 6 }
    ],
    "total": 867000000,
    "average": 123857143,
    "peak": { "date": "2026-08-31", "revenue": 148000000 },
    "previousTotal": 773000000,
    "changePercent": 12.2,
    "invoiceCount": 43,
    "ranges": {
      "1":  { "range": 1,  "from": "2026-09-03", "to": "2026-09-03", "series": [], "total": 128500000, "average": 128500000, "peak": {}, "previousTotal": 141900000, "changePercent": -9.4, "invoiceCount": 6 },
      "7":  { "range": 7,  "from": "2026-08-28", "to": "2026-09-03", "series": [], "total": 867000000, "average": 123857143, "peak": {}, "previousTotal": 773000000, "changePercent": 12.2, "invoiceCount": 43 },
      "14": { "range": 14, "from": "2026-08-21", "to": "2026-09-03", "series": [], "total": 1640000000, "average": 117142857, "peak": {}, "previousTotal": 1512000000, "changePercent": 8.5, "invoiceCount": 84 },
      "30": { "range": 30, "from": "2026-08-05", "to": "2026-09-03", "series": [], "total": 3480000000, "average": 116000000, "peak": {}, "previousTotal": 3295000000, "changePercent": 5.6, "invoiceCount": 178 }
    }
  }
}
```

Ghi chú cho FE:
- `series` luôn có **đủ số điểm bằng `range`**, ngày không phát sinh tiền trả `revenue: 0` chứ không bị bỏ khỏi mảng — vẽ biểu đồ không cần vá lỗ.
- `revenue` và `amount` là cùng một số, để tương thích cả hai tên field client đang đọc.
- `label` là thứ trong tuần (`T2`…`CN`), `dateLabel` là `dd/MM` — dùng `dateLabel` cho khoảng 14/30 ngày vì thứ bị lặp lại.
- `changePercent` so với **kỳ liền trước cùng độ dài**, trả `null` khi kỳ trước chưa có doanh thu (đừng hiển thị `0%` trong trường hợp này).

### Quy tắc tính doanh thu (áp dụng cho mọi endpoint tiền)

Ba endpoint `/analytics/dashboard`, `/analytics/revenue/daily` và `/invoices/summary` trước đây mỗi chỗ lọc một kiểu nên trả ba con số khác nhau cho cùng một ngày. Nay dùng chung một quy tắc:

| Quy tắc | Giá trị |
|---|---|
| Số tiền lấy từ | `paidAmount` (**tiền thực thu**), không phải `finalAmount` |
| Gán vào ngày nào | `paidAt` (ngày thanh toán), không phải `createdAt` |
| Trạng thái được tính | `PAID` **và** `PARTIAL` — tiền đã vào két thì phải thấy |
| Trạng thái bị loại | `UNPAID`, `REFUNDED` |
| Múi giờ cắt ngày | `Asia/Ho_Chi_Minh` (`TZ` đặt trong `render.yaml` + `Dockerfile`) |

FE **không tự cộng `paidAmount` client-side nữa** — con số đó sai ngay khi có phân trang. Lấy `todayRevenue` từ `/invoices/summary` hoặc `/analytics/dashboard`.

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
