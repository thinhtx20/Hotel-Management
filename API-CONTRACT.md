# Hợp đồng API chuẩn hóa — Hệ thống Khách sạn Luxe Grand

Tài liệu này giải đáp chi tiết 10 câu hỏi quy ước (Mục 07) và tổng hợp tất cả các endpoint đã được hoàn thiện trên backend NestJS theo tài liệu rà soát [Khoảng Trống API Luxe Grand](https://claude.ai/code/artifact/a9723aad-ae9e-4d6a-b702-970e9b965190).

> **Ai được gọi endpoint nào?** Tài liệu này chỉ mô tả payload. Ma trận phân quyền theo từng vai trò (`ADMIN` / `RECEPTIONIST` / `CASHIER` / `CUSTOMER`), kèm hướng dẫn dựng menu và bảng tra lỗi `403` cho FE, nằm ở [docs/FE-ROLE-MATRIX.md](docs/FE-ROLE-MATRIX.md).

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

### C2. Hóa đơn của chính khách hàng (`GET /api/v1/invoices/my?status=`)

Endpoint dành cho màn "Hóa đơn của tôi" bên app khách hàng. Không cần truyền tham số nào — backend lọc theo tài khoản trong access token, chỉ trả hóa đơn gắn với đơn đặt phòng của người đó. Cấu trúc mỗi phần tử giống hệt `GET /invoices/:id` (có `items`, `payments`, `roomNumber`, `customerName`).

```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": "inv-uuid-789",
      "invoiceCode": "INV-2026-0089",
      "bookingId": "b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1",
      "roomNumber": "101",
      "customerName": "Nguyễn Anh Tuấn",
      "roomAmount": 3600000,
      "servicesAmount": 200000,
      "finalAmount": 3800000,
      "paidAmount": 3800000,
      "paymentStatus": "PAID",
      "items": [{ "name": "Tiền thuê phòng P.101", "quantity": 1, "unitPrice": 3600000, "amount": 3600000 }],
      "payments": [{ "amount": 3800000, "paymentMethod": "CASH", "paidAt": "2026-09-08T11:50:00.000Z", "cashierName": "Trần Văn Minh (Thu Ngân)" }]
    }
  ]
}
```

Lọc tùy chọn: `?status=UNPAID | PARTIAL | PAID | REFUNDED`.

`GET /invoices/:id` cũng đã mở cho `CUSTOMER`, nhưng **chỉ với hóa đơn thuộc đơn đặt phòng của chính khách** — sai chủ sở hữu trả `403`. Xem [ma trận phân quyền](docs/FE-ROLE-MATRIX.md) để biết đầy đủ.

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

### I. Đăng xuất tài khoản (`POST /api/v1/auth/logout`)
- **Mục đích:** Hủy phiên làm việc của người dùng, đưa Access Token vào Blacklist (Redis) và thu hồi Refresh Token tương ứng để tránh bị tấn công phát lại.
- **Headers:** `Authorization: Bearer <accessToken>` *(Khuyến nghị; tùy chọn nếu gửi kèm refreshToken trong body)*
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
*(Ghi chú: Trường `refreshToken` là tùy chọn. Nếu truyền kèm, hệ thống chỉ thu hồi phiên đăng nhập tương ứng trên thiết bị đó. Nếu bỏ trống nhưng có Bearer token, hệ thống sẽ thu hồi toàn bộ các phiên của tài khoản).*

- **Response thành công (Status 200 OK):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Đăng xuất thành công",
  "data": {
    "success": true,
    "message": "Đăng xuất thành công"
  },
  "timestamp": "2026-09-04T08:00:00.000Z"
}
```

- **Quy tắc xử lý:**
  1. **Hỗ trợ khi Access Token hết hạn:** Endpoint được cấu hình mở (`@Public()`), cho phép người dùng vẫn đăng xuất dọn dẹp phiên thành công ngay cả khi Access Token đã hết hạn (chỉ cần gửi `refreshToken`).
  2. **Access Token Blacklisting:** Nếu client gửi kèm Bearer Access Token, backend sẽ giải mã lấy `exp`, tính thời gian sống còn lại và lưu vào Redis key `auth:blacklist:<token>` với TTL tương ứng. Các request tiếp theo dùng token này sẽ bị từ chối `401 Unauthorized`.
  3. **Refresh Token Revocation:** Nếu client gửi kèm `refreshToken`, key `auth:refresh:<userId>:<jti>` sẽ bị xóa khỏi Redis, ngăn chặn việc tái sử dụng để làm mới token.

---

### J. Tải lên và Lưu trữ Hình ảnh (Supabase Storage)

Hệ thống sử dụng **Supabase Storage** làm kho lưu trữ tệp tin đám mây. Backend NestJS hoạt động như proxy trung gian xác thực JWT, kiểm duyệt định dạng/kích thước ảnh và cấp Public URL.

#### 1. Tải lên 1 ảnh đơn (Avatar / Tiện ích / Ảnh đại diện)
- **Endpoint:** `POST /api/v1/upload/image`
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Query Params:**
  - `folder` *(tùy chọn)*: `avatars` | `rooms` | `services` | `general` (mặc định: `general`).
- **Form Data:**
  - `file`: Tệp hình ảnh binary (`JPG`, `JPEG`, `PNG`, `WEBP`, `GIF`), dung lượng <= 5MB.
- **Response thành công (Status 201 Created):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Tải ảnh lên Supabase thành công",
  "data": {
    "url": "https://xyzcompany.supabase.co/storage/v1/object/public/hotel-images/avatars/1725432000-uuid.webp",
    "path": "avatars/1725432000-uuid.webp",
    "size": 245600,
    "mimetype": "image/webp",
    "originalName": "avatar.webp"
  },
  "timestamp": "2026-09-04T09:00:00.000Z"
}
```
- **Luồng cập nhật Avatar trên Client:**
  1. Gọi `POST /api/v1/upload/image?folder=avatars` với file ảnh chọn từ thư viện.
  2. Lấy giá trị `data.url` từ kết quả.
  3. Gọi `PATCH /api/v1/users/me` với payload: `{ "avatar": data.url }`.

---

#### 2. Tải lên nhiều ảnh (Album ảnh loại phòng / Tiện nghi)
- **Endpoint:** `POST /api/v1/upload/images`
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Query Params:**
  - `folder` *(tùy chọn)*: `rooms` | `services` | `general` (mặc định: `rooms`).
- **Form Data:**
  - `files`: Danh sách tối đa 10 tệp hình ảnh binary (mỗi tệp <= 5MB).
- **Response thành công (Status 201 Created):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Tải danh sách ảnh thành công",
  "data": {
    "files": [
      {
        "url": "https://xyzcompany.supabase.co/storage/v1/object/public/hotel-images/rooms/1725432000-1.webp",
        "path": "rooms/1725432000-1.webp",
        "size": 450120,
        "mimetype": "image/webp",
        "originalName": "deluxe-1.webp"
      },
      {
        "url": "https://xyzcompany.supabase.co/storage/v1/object/public/hotel-images/rooms/1725432000-2.webp",
        "path": "rooms/1725432000-2.webp",
        "size": 380450,
        "mimetype": "image/webp",
        "originalName": "deluxe-2.webp"
      }
    ],
    "urls": [
      "https://xyzcompany.supabase.co/storage/v1/object/public/hotel-images/rooms/1725432000-1.webp",
      "https://xyzcompany.supabase.co/storage/v1/object/public/hotel-images/rooms/1725432000-2.webp"
    ]
  },
  "timestamp": "2026-09-04T09:00:00.000Z"
}
```
- **Luồng cập nhật Loại phòng trên Client:**
  1. Gọi `POST /api/v1/upload/images?folder=rooms` với danh sách ảnh phòng.
  2. Lấy mảng `data.urls`.
  3. Gán thẳng vào `images` của DTO tạo/sửa loại phòng: `POST /api/v1/room-types` hoặc `PATCH /api/v1/room-types/:id`.

---

#### 3. Xóa ảnh khỏi kho lưu trữ
- **Endpoint:** `DELETE /api/v1/upload?path=avatars/1725432000-uuid.webp`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response thành công (Status 200 OK):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Đã xóa ảnh thành công khỏi bucket",
  "data": {
    "success": true,
    "message": "Đã xóa ảnh \"avatars/1725432000-uuid.webp\" thành công khỏi bucket"
  }
}
```

---

### K. Chi tiết phòng (`GET /api/v1/rooms/:id`) — Phục vụ Màn chi tiết phòng trên Mobile/Web FE

Endpoint công khai cho khách vãng lai và người dùng (`@Public()`), đồng thời hỗ trợ nạp quyền nội bộ nếu có Bearer token.
Dữ liệu đã được **phẳng hóa (flattened)** kết hợp tự động từ `Room` và `RoomType`, đi kèm bộ sưu tập ảnh sắc nét, phân nhóm tiện ích, chính sách nhận trả phòng và đánh giá chi tiết của khách hàng để Frontend dựng giao diện chi tiết phòng chuẩn 5 sao.

#### 1. Thông tin Endpoint
- **URL:** `GET /api/v1/rooms/:id` (hoặc `GET /api/v1/rooms` cho danh sách phẳng)
- **Quyền:** Mở cho tất cả mọi người (`PUBLIC`). Gửi kèm `Authorization: Bearer <token>` để nhận thêm trường nội bộ `notes` (dành cho `ADMIN` và `RECEPTIONIST`).

#### 2. Payload mẫu trả về (Response Body 200 OK)
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": "301-uuid-deluxe",
    "roomNumber": "301",
    "floor": 3,
    "status": "AVAILABLE",
    "roomTypeId": "type-uuid-dlx",
    "roomTypeName": "Deluxe Ocean Panorama",
    "roomTypeCode": "DLX-OV",
    "description": "Tận hưởng kỳ nghỉ dưỡng thiên đường tại Deluxe Ocean Panorama với ban công riêng lộng gió mở ra tầm nhìn 180 độ ôm trọn biển xanh ngọc bích. Nổi bật với bồn tắm ngâm sâu đặt ngay cạnh cửa sổ lớn hướng biển để bạn vừa thưởng thức rượu vang vừa ngắm hoàng hôn rực rỡ. Đệm lò xo túi lông vũ siêu êm ái, máy pha cà phê Nespresso và loa Marshall đỉnh cao tạo nên kỳ nghỉ hoàn hảo.",
    "pricePerNight": 1450000,
    "image": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    "imageUrl": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    "images": [
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80"
    ],
    "bedType": "1 Giường King đôi siêu lớn (2.0m x 2.2m) đệm lông vũ cao cấp",
    "viewType": "Hướng trực diện biển 180 độ (Ocean Panorama)",
    "sizeSqM": 45,
    "area": 45,
    "capacityAdults": 2,
    "capacityChildren": 2,
    "capacity": 4,
    "rating": 4.95,
    "reviewCount": 124,
    "highlights": [
      "Ban công riêng ngắm bình minh và hoàng hôn biển",
      "Bồn tắm nằm ngắm biển thư giãn với muối khoáng",
      "Máy pha cà phê Nespresso & Loa Bluetooth Marshall",
      "Miễn phí Buffet sáng 5 sao & Trà chiều tại sảnh"
    ],
    "policies": {
      "checkInTime": "14:00",
      "checkOutTime": "12:00",
      "cancellation": "Miễn phí hủy phòng trước 24 giờ trước thời điểm nhận phòng (hoàn tiền 100%)",
      "smoking": "Phòng không hút thuốc (Có ban công hoặc khu vực dành riêng ngoài trời)",
      "pet": "Không mang theo thú cưng vào khuôn viên phòng nghỉ",
      "children": "Trẻ em dưới 6 tuổi được ở miễn phí khi ngủ chung giường với bố mẹ"
    },
    "ratingBreakdown": {
      "cleanliness": 5.0,
      "comfort": 5.0,
      "location": 5.0,
      "service": 4.9,
      "value": 4.9
    },
    "amenities": [
      "Ban công riêng 12m² view trực diện biển",
      "Bồn tắm nằm ngắm biển thư giãn với muối khoáng",
      "Giường ngủ King đôi siêu lớn đệm lông vũ",
      "Máy pha cà phê Nespresso viên nén cao cấp",
      "Loa Bluetooth Marshall Acton nghe nhạc sống động",
      "Mỹ phẩm phòng tắm cao cấp L’Occitane (Pháp)",
      "Smart TV 55 inch 4K HDR có sẵn Netflix",
      "Bữa sáng buffet 5 sao phục vụ tại phòng ngủ",
      "Rượu vang chào mừng và trái cây tươi theo mùa",
      "Phòng tắm kính vòi sen trần Rain Shower",
      "Áo choàng tắm dệt sợi waffle siêu mềm mịn",
      "Điều hòa âm trần inverter lọc không khí Nanoe",
      "Hệ thống đèn ngủ ambient light tùy chỉnh cảm xúc",
      "Minibar miễn phí nước suối, trà & cà phê hảo hạng",
      "Dịch vụ dọn phòng 2 lần/ngày kèm mở giường buổi tối"
    ],
    "amenityGroups": [
      {
        "groupName": "Phòng ngủ & Thư giãn",
        "icon": "bed",
        "items": ["Giường King siêu lớn nệm lông vũ", "Ban công riêng rộng rãi có ghế tắm nắng", "Rèm mở tự động thông minh", "Góc thư giãn lãng mạn"]
      },
      {
        "groupName": "Phòng tắm & Vệ sinh",
        "icon": "bathtub",
        "items": ["Bồn tắm nằm ngắm biển trực diện", "Đồ vệ sinh cao cấp L’Occitane", "Áo choàng tắm waffle siêu êm", "Vòi sen trần Rain Shower"]
      },
      {
        "groupName": "Công nghệ & Giải trí",
        "icon": "tv",
        "items": ["Smart TV 55 inch 4K HDR", "Loa Bluetooth Marshall Acton", "Hệ thống điều khiển ánh sáng cảm ứng", "Wifi 6 cực mạnh"]
      },
      {
        "groupName": "Ẩm thực & Dịch vụ",
        "icon": "restaurant",
        "items": ["Máy pha cafe Nespresso kèm viên nén", "Rượu vang chào mừng tặng kèm", "Bữa sáng buffet tận phòng theo yêu cầu", "Dịch vụ dọn phòng 2 lần/ngày"]
      }
    ],
    "reviews": [
      {
        "id": "rev-dlx-1",
        "authorName": "Trần Phương Thảo",
        "authorAvatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        "rating": 5.0,
        "date": "2026-09-01",
        "comment": "Cảm giác ngâm bồn tắm ngắm hoàng hôn buông xuống biển thật sự đắt giá! 10/10 cho trải nghiệm tuyệt vời này.",
        "stayDuration": "Lưu trú 3 đêm"
      },
      {
        "id": "rev-dlx-2",
        "authorName": "Nguyễn Quốc Hưng",
        "authorAvatar": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
        "rating": 5.0,
        "date": "2026-08-26",
        "comment": "Phòng đẹp hơn cả trong ảnh. Loa Marshall nghe nhạc cực chill. Dịch vụ đưa đón và phục vụ lễ tân chuyên nghiệp.",
        "stayDuration": "Lưu trú 2 đêm"
      }
    ],
    "currentBooking": null
  }
}
```

#### 3. Hướng dẫn sử dụng cho FE
1. **Slider ảnh phòng**: Đọc trực tiếp mảng `data.images` (luôn có từ 4 đến 6 ảnh chất lượng cao). Sử dụng `data.image` làm ảnh đại diện chính.
2. **Thẻ thông số nhanh**: Hiển thị `data.sizeSqM` (m²), `data.bedType` (loại giường), `data.viewType` (hướng nhìn), `data.capacity` (sức chứa khách).
3. **Danh mục tiện ích dạng nhóm**: Render theo mảng `data.amenityGroups` để phân tách rõ ràng các nhóm: Phòng ngủ, Phòng tắm, Công nghệ & Giải trí, Ẩm thực & Dịch vụ.
4. **Đánh giá & Review**:
   - Khối tổng quan: Dùng `data.rating` (ví dụ 4.95) và `data.reviewCount` (ví dụ 124 đánh giá).
   - Thanh điểm chi tiết: Dùng `data.ratingBreakdown` (5 tiêu chí 0.0 - 5.0).
   - Danh sách nhận xét: Lặp qua `data.reviews` để vẽ card nhận xét của từng khách hàng.
5. **Chính sách**: Render bảng giờ giấc và quy định từ `data.policies`.

---

### L. Tạo phòng mới (`POST /api/v1/rooms`) — Hỗ trợ Linh hoạt từ FE & Cơ chế Chờ duyệt

Endpoint tạo phòng hỗ trợ cả Admin và nhân viên/khách hàng gửi yêu cầu tạo phòng mới.

#### 1. Thông tin Endpoint
- **URL:** `POST /api/v1/rooms`
- **Quyền:** `ADMIN`, `RECEPTIONIST`, `CASHIER`, `CUSTOMER` (`Bearer <accessToken>` bắt buộc).
- **Quy tắc phân quyền & Trạng thái:**
  - `ADMIN`: Phòng tạo ra sẽ được duyệt ngay và có trạng thái `AVAILABLE` (hoặc trạng thái truyền trong `status`).
  - `RECEPTIONIST` / `CASHIER` / `CUSTOMER`: Hệ thống **tự động ép** trạng thái về `PENDING_APPROVAL` (Chờ Admin duyệt), không thể tự kích hoạt phòng. Sau đó Admin sẽ duyệt qua `PATCH /api/v1/rooms/:id/approve` hoặc từ chối qua `PATCH /api/v1/rooms/:id/reject`.

#### 2. Request Body Payload (JSON)
Backend chấp nhận linh hoạt các trường (hỗ trợ cả các alias phổ biến bên FE):
```json
{
  "roomNumber": "405",
  "floor": 4,
  "roomTypeId": "d9e03d76-e17f-4f05-896c-b3a167cf7564",
  "notes": "Phòng góc thoáng mát nhìn ra vườn",
  "pricePerNight": 1200000,
  "imageUrl": "https://images.unsplash.com/photo-1590490360182-c33d57733427",
  "images": [
    "https://images.unsplash.com/photo-1590490360182-c33d57733427",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b"
  ],
  "amenities": ["Wifi tốc độ cao", "Ban công", "Bồn tắm nằm", "Smart TV"]
}
```

*Ghi chú các trường:*
- `roomNumber` *(bắt buộc, string)*: Số phòng duy nhất (VD: `"405"`).
- `floor` *(bắt buộc, int)*: Tầng (>= 1).
- `roomTypeId` *(tùy chọn nếu truyền `roomTypeCode` hoặc `roomTypeName`)*: ID loại phòng.
- `roomTypeCode` / `roomTypeName` *(tùy chọn)*: Nếu FE chưa có UUID của loại phòng, có thể truyền mã (`STD-D`, `DLX-OV`...) hoặc tên loại phòng.
- `price` / `pricePerNight` / `basePrice` *(tùy chọn, number)*: Giá phòng.
- `image` / `imageUrl` / `images` *(tùy chọn)*: Ảnh đại diện hoặc album ảnh upload.
- `amenities` *(tùy chọn, string[])*: Danh sách tiện ích.
- `notes` *(tùy chọn, string)*: Ghi chú nội bộ.

#### 3. Response thành công (Status 201 Created)
Trả về dữ liệu phòng phẳng hóa đầy đủ (`RoomResponse`) sẵn sàng cho FE parse:
```json
{
  "statusCode": 201,
  "success": true,
  "data": {
    "id": "new-room-uuid",
    "roomNumber": "405",
    "floor": 4,
    "status": "PENDING_APPROVAL",
    "roomTypeId": "d9e03d76-e17f-4f05-896c-b3a167cf7564",
    "roomTypeName": "Deluxe Ocean Panorama",
    "roomTypeCode": "DLX-OV",
    "description": "...",
    "pricePerNight": 1450000,
    "image": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    "imageUrl": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    "images": [ ... ],
    "bedType": "1 Giường King đôi siêu lớn (2.0m x 2.2m) đệm lông vũ cao cấp",
    "viewType": "Hướng trực diện biển 180 độ (Ocean Panorama)",
    "sizeSqM": 45,
    "rating": 4.95,
    "reviewCount": 124,
    "highlights": [ ... ],
    "policies": { ... },
    "amenityGroups": [ ... ]
  }
}
```



