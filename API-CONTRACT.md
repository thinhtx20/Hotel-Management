# Hợp đồng API chuẩn hóa — Hệ thống Khách sạn Luxe Grand

Tài liệu này giải đáp chi tiết 10 câu hỏi quy ước (Mục 07) và tổng hợp tất cả các endpoint đã được hoàn thiện trên backend NestJS theo tài liệu rà soát [Khoảng Trống API Luxe Grand](https://claude.ai/code/artifact/a9723aad-ae9e-4d6a-b702-970e9b965190).

> **Ai được gọi endpoint nào?** Tài liệu này chỉ mô tả payload. Ma trận phân quyền theo từng vai trò (`ADMIN` / `RECEPTIONIST` [Lễ tân – Thu ngân] / `CUSTOMER`), kèm hướng dẫn dựng menu và bảng tra lỗi `403` cho FE, nằm ở [docs/FE-ROLE-MATRIX.md](docs/FE-ROLE-MATRIX.md).

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
**Quy tắc:** Endpoint này dành cho **thu ngân thu tiền trực tiếp tại quầy** (`ADMIN` / `RECEPTIONIST`). Backend ghi một dòng vào sổ thu tiền rồi **tự tính lại** `paidAmount` và `paymentStatus` (`PAID` nếu đủ, `PARTIAL` nếu chưa đủ). Client **không cần** tự tính `paymentStatus`.

**Ràng buộc mới:**
- `amount` phải `> 0`.
- `amount` **không được vượt quá số còn phải thu** (`finalAmount - paidAmount`) → `400`. Khách trả dư thì thu đúng số còn lại rồi trả lại tiền thừa.
- Hóa đơn đã `PAID` thì trả `400` với thông báo "Hóa đơn này đã được thanh toán đủ toàn bộ".

**Khách hàng KHÔNG gọi endpoint này.** App khách dùng `POST /invoices/:id/payment-requests` — xem mục [C3](#c3-khách-hàng-tự-thanh-toán-số-tiền-còn-lại).

### 6. Định dạng Ngày Giờ
- Sử dụng chuẩn **ISO 8601** kèm múi giờ UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`) hoặc offset địa phương `+07:00`.
- Khuyến nghị FE sử dụng `DateTime.parse(str).toLocal()` để hiển thị chính xác theo giờ Việt Nam.

### 7. Định dạng Tiền Tệ
- Sử dụng số nguyên **VND** (kiểu `number`, không có số lẻ thập phân).
- Ví dụ: `1500000` thay vì `"1.500.000"` hay `1500000.00`.

### 8. Bảo mật `POST /auth/register`
- Backend **bỏ qua** trường `role` nếu client gửi lên và **ép cứng** quyền `CUSTOMER` tại server.
- `role` đã được gỡ khỏi enum trong Swagger (chỉ còn là trường `deprecated`, kiểu chuỗi, được chấp nhận nhưng bỏ qua) để hợp đồng API không còn gợi ý rằng người dùng công khai có thể tự cấp quyền `ADMIN`.
- Việc cấp quyền `ADMIN`, `RECEPTIONIST` thực hiện qua tài khoản quản trị viên tại **`POST /api/v1/users`** (tạo mới) hoặc `PATCH /api/v1/users/:id` (đổi quyền tài khoản đã có).

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

### 9b. Mỗi tài khoản khách hàng chỉ đăng nhập trên 1 thiết bị
- **Phạm vi:** chỉ vai trò `CUSTOMER`. `ADMIN` / `RECEPTIONIST` vẫn đăng nhập được nhiều máy (quầy lễ tân thường trực nhiều thiết bị).
- **Cơ chế:** mỗi lần đăng nhập thành công, backend sinh mã phiên `sessionId`, lưu vào `users.activeSessionId` và nhúng vào JWT dưới claim `sid`. Mọi request đều đối chiếu `sid` của token với `activeSessionId` trong CSDL — lệch nghĩa là token của thiết bị cũ.
- **Chốt ở CSDL chứ không chỉ ở Redis**, nên ràng buộc vẫn đúng khi Redis chưa bật.
- **Hai chế độ (biến môi trường `SINGLE_DEVICE_MODE`):**

| Chế độ | Hành vi khi khách đăng nhập ở máy thứ 2 |
| --- | --- |
| `kick_old` *(mặc định)* | Máy mới vào bình thường, **máy cũ bị đá ra ngay**. |
| `block_new` | Máy mới bị từ chối `401`, máy cũ giữ nguyên phiên. Phiên cũ tự hết hiệu lực sau `JWT_REFRESH_EXPIRES_IN` (7 ngày) tính từ lần đăng nhập gần nhất, nên khách mất máy cũ không bị khóa vĩnh viễn. |

- **Máy cũ nhận về (mọi endpoint cần đăng nhập, kể cả `POST /auth/refresh-token`):**
```json
{
  "statusCode": 401,
  "success": false,
  "message": "Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác (Chrome trên Windows (IP 14.161.20.7)). Phiên làm việc trên thiết bị này đã kết thúc, vui lòng đăng nhập lại.",
  "error": "SESSION_REVOKED",
  "timestamp": "2026-09-05T08:00:00.000Z",
  "path": "/api/v1/auth/me"
}
```
- **Máy mới bị chặn ở chế độ `block_new` (`POST /auth/login`):** cùng cấu trúc trên với `error: "SESSION_DEVICE_LIMIT"`.
- **FE xử lý:** bắt theo trường `error`.
  - `SESSION_REVOKED` → xóa `accessToken` / `refreshToken` trong storage, hiển thị thông báo và điều hướng về màn đăng nhập. **Không** gọi `refresh-token` để thử lại vì endpoint đó cũng trả cùng lỗi.
  - `SESSION_DEVICE_LIMIT` → hiển thị thông báo yêu cầu đăng xuất ở thiết bị kia, giữ nguyên màn đăng nhập.
- **Nhận diện thiết bị:** backend rút gọn `User-Agent` + IP (`X-Forwarded-For` nếu chạy sau proxy) thành nhãn dễ đọc như `Chrome trên Windows (IP 14.161.20.7)` và trả kèm trong thông điệp lỗi để khách biết phiên đang nằm ở đâu.
- **`POST /auth/logout`** xóa `activeSessionId`, trả tài khoản về trạng thái chưa gắn thiết bị nào.

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

Quyền: `ADMIN`, `RECEPTIONIST`.

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

### C1. Danh sách hóa đơn toàn khách sạn & phân trang (`GET /api/v1/invoices`)

Quyền: `ADMIN`, `RECEPTIONIST`.

Toàn bộ việc phân trang và tìm kiếm hóa đơn đã được xử lý phía máy chủ để tránh tải toàn bộ 500+ hóa đơn cùng lúc làm giật lag giao diện thu ngân.

| Query param | Kiểu | Ghi chú |
|---|---|---|
| `status` | enum | `UNPAID` \| `PARTIAL` \| `PAID` \| `REFUNDED` |
| `search` | string | Tìm kiếm theo mã hóa đơn (`invoiceCode`), tên khách, số điện thoại, email hoặc số phòng |
| `page` | number | Trang cần lấy (mặc định 1, bắt đầu từ 1) |
| `limit` | number | Số hóa đơn mỗi trang (mặc định 20, tối đa 100) |

- Cấu trúc response chuẩn:
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "data": [
      {
        "id": "a9b8c7d6-e5f4-3210-fedc-ba9876543210",
        "invoiceCode": "INV-2026-0089",
        "bookingId": "b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1",
        "roomAmount": 3600000,
        "servicesAmount": 200000,
        "finalAmount": 3800000,
        "paidAmount": 3800000,
        "paymentStatus": "PAID",
        "remainingAmount": 0,
        "roomNumber": "101",
        "customerName": "Nguyễn Văn Khách Hàng",
        "customerPhone": "0912345678"
      }
    ],
    "meta": {
      "total": 507,
      "page": 1,
      "limit": 20,
      "totalPages": 26
    }
  }
}
```
*Tương thích ngược:* Không truyền `page`/`limit` thì `data.data` chứa toàn bộ hóa đơn và `meta.limit = meta.total`, `meta.totalPages = 1`.

### C2. Hóa đơn của chính khách hàng (`GET /api/v1/invoices/my?status=`)

Endpoint dành cho màn "Hóa đơn của tôi" bên app khách hàng. Backend lọc theo tài khoản trong access token, chỉ trả hóa đơn gắn với đơn đặt phòng của người đó. Hỗ trợ tham số `status`, `search`, `page`, `limit`. Cấu trúc trả về `{ data: [...], meta: {...} }` (hoặc mảng phẳng nếu client cũ không truyền phân trang).

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
      "paidAmount": 1000000,
      "paymentStatus": "PARTIAL",

      "depositAmount": 1000000,
      "remainingAmount": 2800000,
      "pendingAmount": 0,
      "hasPendingPaymentRequest": false,
      "canRequestPayment": true,

      "items": [{ "name": "Tiền thuê phòng P.101", "quantity": 1, "unitPrice": 3600000, "amount": 3600000 }],
      "payments": [
        {
          "id": "pay-0001",
          "amount": 1000000,
          "type": "DEPOSIT",
          "paymentMethod": "BANK_TRANSFER",
          "paidAt": "2026-09-01T03:00:00.000Z",
          "reference": null,
          "note": "Tiền cọc giữ chỗ khi duyệt phòng",
          "cashierName": "Trần Văn Minh (Thu Ngân)"
        }
      ],
      "pendingPayments": []
    }
  ]
}
```

**Các trường mới (FE dùng trực tiếp, không tự tính nữa):**

| Trường | Ý nghĩa |
|---|---|
| `remainingAmount` | Số tiền khách **còn phải trả** = `finalAmount - paidAmount`, không bao giờ âm. Chính là dòng "Còn thiếu". Thẻ "CÒN PHẢI THANH TOÁN" ở đầu màn hình = tổng `remainingAmount` của các hóa đơn. |
| `depositAmount` | Tiền cọc đã thu lúc lễ tân duyệt đơn (đã nằm trong `paidAmount`, đừng cộng thêm lần nữa). |
| `payments[]` | Lịch sử thu tiền **thật**, mỗi lần khách trả là một dòng. `type` = `PAYMENT` \| `DEPOSIT` \| `REFUND`; dòng `REFUND` mang `amount` **âm**. |
| `pendingPayments[]` | Yêu cầu thanh toán khách đã gửi nhưng lễ tân chưa xác nhận. |
| `pendingAmount` | Tổng tiền đang chờ xác nhận. |
| `hasPendingPaymentRequest` | `true` khi còn yêu cầu treo → FE hiện "Đang chờ lễ tân xác nhận" thay cho nút thanh toán. |
| `canRequestPayment` | `true` khi được phép bấm "Thanh toán" (`remainingAmount > 0` và không có yêu cầu nào treo). Dùng cái này để bật/tắt nút. |

Lọc tùy chọn: `?status=UNPAID | PARTIAL | PAID | REFUNDED`.

`GET /invoices/:id` cũng đã mở cho `CUSTOMER`, nhưng **chỉ với hóa đơn thuộc đơn đặt phòng của chính khách** — sai chủ sở hữu trả `403`. Xem [ma trận phân quyền](docs/FE-ROLE-MATRIX.md) để biết đầy đủ.

<a id="c3-khách-hàng-tự-thanh-toán-số-tiền-còn-lại"></a>
### C3. Khách hàng tự thanh toán số tiền còn lại

Hệ thống **chưa tích hợp cổng thanh toán**, nên khách trả tiền theo mô hình **gửi yêu cầu → lễ tân đối chiếu → xác nhận**. Tiền chỉ được cộng vào hóa đơn sau khi lễ tân xác nhận, khách không thể tự đánh dấu đã trả.

```
Khách bấm "Thanh toán"          Lễ tân đối chiếu sao kê         Hóa đơn
POST /invoices/:id/                GET /invoices/                 paidAmount tăng
     payment-requests    ───────>       payment-requests  ──────>  remainingAmount giảm
   (tạo dòng PENDING)            POST /invoices/payments/          → PAID khi đủ
   tiền CHƯA vào két                  :paymentId/confirm
```

#### 1. Khách gửi yêu cầu — `POST /api/v1/invoices/:id/payment-requests`

Quyền: `CUSTOMER` (chỉ hóa đơn của chính mình), `RECEPTIONIST`, `ADMIN`.

```json
{
  "paymentMethod": "BANK_TRANSFER",
  "reference": "FT25090512345678",
  "note": "Đã chuyển khoản lúc 14:05, nhờ lễ tân kiểm tra giúp"
}
```

> **Bỏ trống `amount` = thanh toán TOÀN BỘ số còn lại.** Đây chính là nút "Thanh toán toàn bộ". Chỉ truyền `amount` khi khách muốn trả một phần.

Response `201`:
```json
{
  "message": "Đã gửi yêu cầu thanh toán toàn bộ số tiền còn lại. Lễ tân sẽ xác nhận sau khi đối chiếu.",
  "paymentId": "pay-0003",
  "amount": 2564000,
  "remainingAfterConfirm": 0,
  "invoice": { "...": "hóa đơn sau khi tạo yêu cầu" }
}
```

Lỗi thường gặp:

| Mã | Trường hợp |
|---|---|
| `400` | Hóa đơn đã thanh toán đủ (`remainingAmount = 0`) |
| `400` | Đã có một yêu cầu đang chờ xác nhận — mỗi hóa đơn chỉ được treo **một** yêu cầu tại một thời điểm |
| `400` | `amount` vượt quá số còn lại |
| `403` | Hóa đơn không thuộc đơn đặt phòng của khách |

#### 2. Khách hủy yêu cầu bấm nhầm — `DELETE /api/v1/invoices/:id/payment-requests/:paymentId`

Chỉ hủy được yêu cầu còn `PENDING`. Đã được lễ tân xử lý thì trả `400`.

#### 3. Lễ tân xem hàng chờ — `GET /api/v1/invoices/payment-requests?status=PENDING`

Quyền: `ADMIN`, `RECEPTIONIST`. Mặc định trả các yêu cầu `PENDING`.

```json
[
  {
    "id": "pay-0003",
    "invoiceId": "inv-uuid-789",
    "invoiceCode": "INV-2025-0289",
    "roomNumber": "103",
    "customerName": "Nguyễn Văn A",
    "customerPhone": "0912345678",
    "amount": 2564000,
    "paymentMethod": "BANK_TRANSFER",
    "status": "PENDING",
    "reference": "FT25090512345678",
    "requestedAt": "2026-09-05T07:05:00.000Z",
    "invoiceFinalAmount": 5832000,
    "invoicePaidAmount": 3268000,
    "invoiceRemainingAmount": 2564000
  }
]
```

#### 4. Lễ tân xác nhận đã nhận tiền — `POST /api/v1/invoices/payments/:paymentId/confirm`

Body rỗng `{}` là đủ. Truyền `amount` nếu khách chuyển thiếu so với số đã yêu cầu, truyền `paymentMethod` nếu khách đổi hình thức trả.

```json
{
  "message": "Đã xác nhận thu 2.564.000đ. Hóa đơn đã thanh toán đủ.",
  "paymentId": "pay-0003",
  "amount": 2564000,
  "invoice": { "...": "hóa đơn đã cập nhật paidAmount / remainingAmount" }
}
```

#### 5. Lễ tân từ chối — `POST /api/v1/invoices/payments/:paymentId/reject`

```json
{ "reason": "Không tìm thấy giao dịch với mã FT25090512345678 trên sao kê" }
```

Lý do được trả lại cho khách qua `rejectedReason`. Yêu cầu bị từ chối **không bao giờ** được tính tiền.

#### 6. Sổ thu tiền — nguồn sự thật duy nhất

`invoices.paidAmount` **không còn được cộng/trừ thủ công ở bất kỳ đâu**. Nó luôn được tính lại từ bảng `payments`:

```
paidAmount = Σ(PAYMENT + DEPOSIT đã CONFIRMED) − Σ(REFUND đã CONFIRMED)
```

Nhờ vậy tiền cọc, các lần khách trả qua app, tiền thu tại quầy và tiền hoàn đều nằm chung một sổ, và `remainingAmount` luôn khớp với thực tế. Dữ liệu cũ được tự động quy đổi thành một dòng thu khi khởi động ứng dụng.

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

Hỗ trợ bộ lọc theo trạng thái, tầng, hạng phòng, tìm kiếm theo số phòng và phân trang:

| Query param | Kiểu | Ghi chú |
|---|---|---|
| `status` | enum `RoomStatus` | `AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `MAINTENANCE` |
| `floor` | number | Lọc theo số tầng (>= 1) |
| `roomTypeId` | string | UUID của loại phòng |
| `search` | string | Tìm kiếm theo số phòng hoặc tên loại phòng |
| `page` | number | Trang cần lấy (bắt đầu từ 1) |
| `limit` | number | Số phòng mỗi trang (mặc định 20, tối đa 100) |

Mỗi phòng khi có khách (`OCCUPIED`) sẽ tự động có thêm `currentBooking`:
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "data": [
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
    ],
    "meta": {
      "total": 20,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```
*Tương thích ngược:* Không truyền `page`/`limit` thì `data.data` chứa toàn bộ phòng và `meta.limit = meta.total`. Client Flutter dùng `ApiResult.unwrapList` bóc dữ liệu tự động.

### H. Check-out phòng (`POST /api/v1/bookings/:id/check-out`)

#### H1. Xem trước bảng quyết toán — `GET /api/v1/bookings/:id/checkout-preview`

**Gọi endpoint này ngay khi thu ngân bấm "Check-out"** để biết chính xác phải thu bao nhiêu. Chỉ đọc, không đổi trạng thái đơn hay phòng. Quyền: `ADMIN`, `RECEPTIONIST`.

```json
{
  "bookingCode": "BK-2026-0829",
  "status": "CHECKED_IN",
  "roomNumber": "103",
  "customerName": "Nguyễn Văn A",
  "invoiceId": "inv-uuid-789",

  "roomAmount": 5000000,
  "servicesAmount": 300000,
  "discount": 0,
  "taxRate": 0.1,
  "tax": 530000,
  "finalAmount": 5830000,

  "depositAmount": 1000000,
  "alreadyPaidAmount": 3268000,
  "amountDue": 2562000,

  "serviceItems": [
    { "id": "svc-1", "name": "Minibar trọn gói", "quantity": 1, "unitPrice": 300000, "amount": 300000 }
  ],
  "pendingPaymentRequests": [],
  "pendingPaymentAmount": 0
}
```

- **`amountDue` = số tiền còn phải thu của khách.** Đây là con số thu ngân cần thấy trên màn hình check-out.
- `alreadyPaidAmount` đã bao gồm tiền cọc và mọi lần khách trả trước qua app.
- `pendingPaymentRequests` là các yêu cầu khách gửi qua app chưa đối chiếu — **xử lý hết danh sách này trước khi thu tiền mặt** để tránh thu trùng.

#### H2. Chốt trả phòng — `POST /api/v1/bookings/:id/check-out`

```json
{
  "amountCollected": 2562000,
  "paymentMethod": "CASH",
  "note": "Khách trả nốt bằng tiền mặt tại quầy",
  "discount": 0,
  "taxRate": 0.1
}
```

| Trường | Ý nghĩa |
|---|---|
| `amountCollected` | Số tiền thu ngân **thực nhận tại quầy**. **Bỏ trống = không thu thêm đồng nào** — phần còn thiếu được đẩy về app cho khách tự thanh toán. Vượt quá `amountDue` → `400`. |
| `paymentMethod` | Hình thức thu tại quầy (mặc định `CASH`). |
| `note` | Ghi chú cho khoản thu này. |

**Thay đổi quan trọng so với trước:** check-out **không còn ép hóa đơn thành `PAID`** nữa. Trước đây endpoint này ghi đè `paidAmount = finalAmount` bất kể khách đã trả bao nhiêu, làm mất dấu tiền cọc và thổi phồng doanh thu. Nay hóa đơn chỉ chốt **số tiền phải trả**; số đã thu được tính lại từ sổ thu tiền.

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "message": "Check-out thành công. Hóa đơn còn thiếu 2.562.000đ đã được gửi về mục \"Hóa đơn của tôi\" để khách thanh toán nốt.",
    "invoiceId": "inv-uuid-789",
    "amountCollected": 0,
    "remainingAmount": 2562000,
    "settlement": { "...": "giống hệt checkout-preview" },
    "booking": { "...": "status: CHECKED_OUT" },
    "invoice": { "...": "paymentStatus: PARTIAL" }
  }
}
```

Khách còn nợ **vẫn được trả phòng** (phòng chuyển `CLEANING` như cũ). Hóa đơn ở trạng thái `PARTIAL` / `UNPAID` tự động xuất hiện trong `GET /invoices/my` của khách với `remainingAmount > 0` và `canRequestPayment: true`, khách thanh toán nốt qua luồng ở mục [C3](#c3-khách-hàng-tự-thanh-toán-số-tiền-còn-lại).

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
- **Quyền:** `ADMIN`, `RECEPTIONIST`, `CUSTOMER` (`Bearer <accessToken>` bắt buộc).
- **Quy tắc phân quyền & Trạng thái:**
  - `ADMIN`: Phòng tạo ra sẽ được duyệt ngay và có trạng thái `AVAILABLE` (hoặc trạng thái truyền trong `status`).
  - `RECEPTIONIST` / `CUSTOMER`: Hệ thống **tự động ép** trạng thái về `PENDING_APPROVAL` (Chờ Admin duyệt), không thể tự kích hoạt phòng. Sau đó Admin sẽ duyệt qua `PATCH /api/v1/rooms/:id/approve` hoặc từ chối qua `PATCH /api/v1/rooms/:id/reject`.

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

---

### K. Duyệt & Từ chối Đơn Đặt Phòng Trước và Quản Lý Tiền Cọc

Nhằm phục vụ quy trình nghiệp vụ khách đặt trước qua app hoặc kênh trực tuyến, Lễ tân và Quản trị viên sử dụng các endpoint sau để phê duyệt đơn, ghi nhận tiền cọc hoặc từ chối đơn.

#### 1. Phê duyệt Đơn Đặt Phòng & Xác nhận Tiền Cọc
- **Endpoints:**
  - `PATCH /api/v1/bookings/:id/approve`
  - `POST /api/v1/bookings/:id/approve` *(alias)*
- **Quyền truy cập:** `RECEPTIONIST`, `ADMIN` (yêu cầu Bearer Token).
- **Request Body (Tùy chọn):**
```json
{
  "depositAmount": 500000,
  "paymentMethod": "BANK_TRANSFER",
  "notes": "Khách đã chuyển khoản tiền cọc 500k qua VietQR"
}
```
*Ghi chú:*
- `depositAmount` *(tùy chọn, number >= 0)*: Số tiền cọc khách đóng. Nếu không gửi, backend giữ nguyên số tiền cọc đã nhập lúc tạo đơn (nếu có).
- `paymentMethod` *(tùy chọn, enum)*: `BANK_TRANSFER` (mặc định), `CASH`, `CREDIT_CARD`.
- `notes` *(tùy chọn, string)*: Ghi chú duyệt cọc.

- **Quy tắc xử lý trên Backend:**
  1. Chỉ duyệt được đơn ở trạng thái `PENDING`. Nếu đơn đã `CONFIRMED`, `CANCELLED` hoặc đang `CHECKED_IN`, hệ thống trả về lỗi `400 Bad Request`.
  2. Cập nhật trạng thái đơn: `status = CONFIRMED`.
  3. Cập nhật trạng thái phòng: `status = RESERVED` (Cam hổ phách - Đã cọc giữ chỗ).
  4. Nếu `depositAmount > 0`: Hệ thống tự động tạo hoặc cập nhật bản ghi `Invoice` đặt cọc (`paidAmount = depositAmount`, `paymentStatus = PARTIAL` hoặc `PAID`, `paidAt = now()`, `issuedById = receptionistId`), ghi nhận trực tiếp vào doanh thu thực thu trong ngày.
  5. Giải phóng cache Redis `cache:rooms:*` và đồng bộ Elasticsearch.

- **Response thành công (Status 200 OK):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công",
  "data": {
    "message": "Phê duyệt đơn đặt phòng và xác nhận tiền cọc thành công",
    "depositAmount": 500000,
    "booking": {
      "id": "b1e4c7a2-9d3f-4e8b-8a21-72948e9102c1",
      "bookingCode": "BK-240904-89",
      "customerId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "roomId": "3f6c8d20-41ab-4f27-96a8-208935cba48b",
      "checkInDate": "2026-09-10T14:00:00.000Z",
      "checkOutDate": "2026-09-12T12:00:00.000Z",
      "guestCount": 2,
      "totalAmount": 2400000,
      "depositAmount": 500000,
      "status": "CONFIRMED",
      "paymentStatus": "PARTIAL",
      "nights": 2,
      "room": {
        "id": "3f6c8d20-41ab-4f27-96a8-208935cba48b",
        "roomNumber": "101",
        "status": "RESERVED"
      }
    }
  }
}
```

---

#### 2. Từ chối Đơn Đặt Phòng (Không duyệt)
- **Endpoints:**
  - `PATCH /api/v1/bookings/:id/reject`
  - `POST /api/v1/bookings/:id/reject` *(alias)*
- **Quyền truy cập:** `RECEPTIONIST`, `ADMIN` (yêu cầu Bearer Token).
- **Request Body (Tùy chọn):**
```json
{
  "reason": "Khách không chuyển khoản cọc trong 24h quy định"
}
```
- **Quy tắc xử lý trên Backend:**
  1. Đơn chuyển sang trạng thái `CANCELLED`.
  2. Phòng được trả về trạng thái `AVAILABLE` (Xanh ngọc).
  3. Giải phóng khóa lịch, xóa cache Redis để khách khác có thể đặt phòng này.

---

#### 3. Quy trình Đặt phòng trước của Khách (`POST /api/v1/bookings`)
- Khi người dùng đăng nhập quyền `CUSTOMER` tạo đơn:
  - Trường `status` mặc định luôn là **`PENDING`** (Chờ duyệt).
  - Có thể truyền số tiền cọc muốn cọc trước: `"depositAmount": 500000`.
  - Hệ thống tự động khóa lịch chống trùng phòng (Overlap conflict check bao gồm cả đơn `PENDING`).

---

## 3. Bổ sung theo phản hồi tích hợp FE (2026-09-04)

### M. Xác nhận đơn `PENDING → CONFIRMED` (`PATCH|POST /api/v1/bookings/:id/confirm`)
Đường đi chính thức cho màn **"Chờ xác nhận"** của Admin/Lễ tân. Tương đương nghiệp vụ với `:id/approve` (vẫn giữ để không vỡ client cũ) nhưng đúng tên gọi trên giao diện và có thêm khả năng xếp phòng.

- **Quyền:** `ADMIN`, `RECEPTIONIST`.
- **Request body (tất cả đều không bắt buộc, gửi `{}` vẫn xác nhận được):**

```json
{
  "assignedRoomId": "3f6c8d20-41ab-4f27-96a8-208935cba48b",
  "note": "Khách đã chuyển khoản cọc, xếp phòng tầng cao theo yêu cầu",
  "depositAmount": 500000,
  "paymentMethod": "BANK_TRANSFER"
}
```

- `assignedRoomId` — bỏ trống thì giữ nguyên phòng khách đã chọn. Nếu truyền phòng khác, hệ thống kiểm tra trùng lịch trước; trùng thì trả `409 Conflict`, phòng cũ được tự động trả về đúng trạng thái.
- `note` — lưu vào `booking.confirmationNote`.
- `depositAmount > 0` — tạo/cập nhật hóa đơn cọc như `:id/approve`.
- **Kết quả:** đơn chuyển `CONFIRMED` kèm `confirmedAt`, `confirmedBy`, `confirmationNote`; phòng được xếp chuyển `RESERVED`.

### N. Hủy đơn có lý do (`POST|PATCH /api/v1/bookings/:id/cancel`)
Trước đây endpoint này không nhận body nên lý do hủy do FE thu thập bị vứt bỏ.

- **Request body:**

```json
{ "cancellationReason": "Khách báo bận công tác đột xuất, xin hủy phòng" }
```

  `reason` được chấp nhận như alias để client cũ không vỡ.
- **Quyền hủy theo vai trò và trạng thái đơn:**

| Trạng thái đơn | `CUSTOMER` tự hủy | `ADMIN` / `RECEPTIONIST` hủy hộ |
|---|---|---|
| `PENDING` (chờ lễ tân xác nhận) | ✅ | ✅ |
| `CONFIRMED` (lễ tân đã xác nhận) | ❌ `403 Forbidden` | ✅ |
| `CHECKED_IN` (đã nhận phòng) | ❌ `400 Bad Request` | ❌ `400 Bad Request` |
| `CHECKED_OUT` / `CANCELLED` | ❌ `400 Bad Request` | ❌ `400 Bad Request` |

  Khách tự hủy đơn đã được xác nhận nhận `403` với message:
  `"Đơn đặt phòng đã được lễ tân xác nhận nên không thể tự hủy. Vui lòng liên hệ lễ tân để được hỗ trợ."`
  Lý do: phòng đã bị giữ chỗ và tiền cọc đã ghi nhận, việc hủy phải qua lễ tân để xử lý cọc/hoàn tiền.
- **`canCancel` trong response phụ thuộc vai trò người gọi** — token `CUSTOMER` chỉ thấy `canCancel: true` khi đơn còn `PENDING`; token lễ tân/admin thấy `true` với cả `PENDING` và `CONFIRMED`. FE dùng thẳng cờ này để ẩn/hiện nút "Hủy đơn", không cần tự suy luận theo status.
- `PATCH|POST /bookings/:id/reject` (lễ tân từ chối đơn) cũng ghi lý do vào **cùng một trường** `cancellationReason`.
- **Mọi response đơn đặt phòng** (list, chi tiết, cancel, reject) nay luôn có các trường sau, giá trị `null` khi chưa dùng tới:

```json
{
  "cancellationReason": "Khách báo bận công tác đột xuất, xin hủy phòng",
  "cancelledAt": "2026-09-04T03:20:00.000Z",
  "cancelledBy": { "id": "...", "fullName": "Nguyễn Anh Tuấn", "role": "CUSTOMER" },
  "confirmedAt": null,
  "confirmedBy": null,
  "confirmationNote": null
}
```

### O. Lọc / tìm kiếm / phân trang đơn đặt phòng (`GET /api/v1/bookings`)
Toàn bộ việc lọc đã chuyển về phía máy chủ, FE không cần tải hết rồi lọc trong máy nữa.

| Query param | Kiểu | Ghi chú |
|---|---|---|
| `status` | enum, **nhiều giá trị** | `?status=PENDING,CONFIRMED` hoặc lặp `?status=PENDING&status=CONFIRMED` |
| `customerId` | string | Khách hàng luôn bị khóa về đơn của chính mình, bất kể giá trị gửi lên |
| `roomId` | string | |
| `checkInFrom` / `checkInTo` | date | Bao trọn ngày (00:00:00 → 23:59:59 giờ máy chủ) |
| `checkOutFrom` / `checkOutTo` | date | Bao trọn ngày |
| `search` | string | Không phân biệt hoa thường, khớp tên khách / SĐT / email / `bookingCode` / số phòng |
| `page` | number | Bắt đầu từ 1 |
| `limit` | number | Mặc định 20, tối đa 100 |

- Ví dụ **"Nhận phòng hôm nay"** (lấy cả đơn `PENDING` đến hạn, không chỉ `CONFIRMED`):
  `GET /api/v1/bookings?status=PENDING,CONFIRMED&checkInFrom=2026-09-04&checkInTo=2026-09-04`

- ⚠️ **Thay đổi phá vỡ tương thích:** `data` của response nay là **object bọc**, không còn là mảng trần:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "data": [ /* danh sách đơn */ ],
    "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
  }
}
```

  Không truyền `page`/`limit` thì `data.data` chứa toàn bộ kết quả và `meta.limit = meta.total`.

### P. Đồng bộ trạng thái phòng ↔ đơn đặt phòng (`POST /api/v1/rooms/sync-status`)
Chữa dữ liệu lệch (phòng `OCCUPIED` mà không có đơn `CHECKED_IN` nào, phòng `RESERVED` mà đơn giữ chỗ đã bị hủy).

- **Quyền:** `ADMIN`, `RECEPTIONIST`.
- **Quy tắc suy diễn (nguồn sự thật duy nhất, dùng chung cho mọi thao tác booking):**
  - Có đơn `CHECKED_IN` → `OCCUPIED`
  - Có đơn `CONFIRMED` chưa tới ngày trả phòng → `RESERVED`
  - Còn lại → `AVAILABLE` (giữ nguyên nếu đang `CLEANING`)
  - Đơn **`PENDING` không giữ phòng** — khách mới gửi yêu cầu, lễ tân chưa xác nhận.
  - `MAINTENANCE` / `PENDING_APPROVAL` / `REJECTED` giữ nguyên vì do người vận hành đặt tay.
- Quy tắc này cũng chạy tự động sau mọi thao tác tạo đơn / xác nhận / hủy / từ chối, nên dữ liệu không lệch lại lần nữa.
- **Trạng thái phòng đổi theo từng bước của đơn:**

| Thao tác | Trạng thái phòng sau đó |
|---|---|
| Khách đặt phòng → `PENDING` | Không đổi (đơn chờ duyệt không giữ phòng) |
| Lễ tân xác nhận (`:id/confirm`, `:id/approve`) | `RESERVED` — suy ra từ lịch đặt, nên phòng đang có khách khác lưu trú vẫn giữ `OCCUPIED` thay vì bị ghi đè |
| Check-in (`:id/check-in`) | `OCCUPIED` |
| Check-out (`:id/check-out`) | `CLEANING` (chờ buồng phòng, không nhảy thẳng sang `RESERVED` dù còn đơn đặt sau đó) |
| Hủy / từ chối đơn | Suy diễn lại: `OCCUPIED` / `RESERVED` / `CLEANING` / `AVAILABLE` tùy các đơn còn hiệu lực |

- Xác nhận đơn trên phòng đang `MAINTENANCE` bị chặn bằng `400 Bad Request` (`"Phòng được xếp đang bảo trì, không thể nhận khách"`), kể cả khi lễ tân giữ nguyên phòng khách đã chọn — trước đây chỉ kiểm tra khi đổi sang phòng khác.
- Mọi lần đổi trạng thái phòng (theo đơn hoặc đổi tay qua `PATCH /rooms/:id/status`) đều xóa cache Redis **và** đẩy lại document lên Elasticsearch, nên `GET /rooms/search?status=...` không còn trả về trạng thái cũ.

### Q. Admin tạo tài khoản nhân viên (`POST /api/v1/users`)
Thay cho việc mượn `POST /auth/register`.

- **Quyền:** `ADMIN`.
- **Request body:** `{ email, password, fullName, role, phone?, avatar?, isActive? }` với `role` ∈ `ADMIN | RECEPTIONIST | CUSTOMER`.
- Trùng email trả `409 Conflict`.

### R. Sửa `totalInvoices` ở `GET /api/v1/invoices/summary`
`totalInvoices` trước đây chỉ đếm theo `createdAt` trong ngày, nên hóa đơn phát hành hôm trước và thu tiền hôm nay vẫn vào `paidInvoices` khiến `totalInvoices: 0` mà `paidInvoices: 1`.
Nay `totalInvoices` đếm hóa đơn **phát hành trong ngày HOẶC có thu tiền trong ngày**. `unpaidInvoices` / `partialInvoices` vẫn là tồn đọng toàn hệ thống (không giới hạn theo ngày).

### S. Hiệu suất nhân viên (`GET /api/v1/analytics/staff-performance`)
- **Quyền:** `ADMIN`.
- **Query params:** `from=YYYY-MM-DD`, `to=YYYY-MM-DD`.
- **Dữ liệu trả về:** Thống kê theo từng nhân viên (`bookingsConfirmed`, `bookingsCancelled`, `invoicesIssued`, `amountCollected`) và dòng tổng `totals`.
- **Không truyền `from`/`to`** thì mặc định lấy từ đầu tháng hiện tại đến hôm nay. Muốn xem cả năm phải truyền `from=YYYY-01-01&to=YYYY-12-31`.

**Dữ liệu mẫu theo năm (BE đã seed sẵn):** CSDL có sẵn lịch sử kinh doanh **2024** và **2025** — mỗi năm đủ 12 tháng đơn đặt phòng đã trả phòng, đơn bị hủy có người hủy, và hóa đơn đã thu tiền có người phát hành. Nhờ vậy:

| Endpoint | Query để lên số | Kết quả mong đợi |
|---|---|---|
| `GET /analytics/revenue` | `?year=2024` / `?year=2025` | Biểu đồ 12 tháng theo mùa (cao điểm hè T6–T8, Tết T2 & T12; thấp điểm T9–T10) |
| `GET /analytics/staff-performance` | `?from=2024-01-01&to=2024-12-31` | Đủ 6 tài khoản nhân sự với số đơn duyệt / hủy / hóa đơn / tiền thu khác nhau |

> **FE lưu ý:** ô chọn năm ở màn Báo cáo cần liệt kê cả **2024, 2025** (không chỉ năm hiện tại), nếu không sẽ không có cách nào xem được dữ liệu hai năm này.
> Thêm năm khác: chạy `npm run db:seed-history -- 2023` ở backend.

### T. Quản lý danh mục dịch vụ CSDL (`/api/v1/services`)
- **Quyền:** `GET` công khai (khách vãng lai, app khách hàng). `POST`, `PATCH`, `DELETE` chỉ dành cho `ADMIN`.
- Lưu trữ trong bảng `hotel_services` với giá niêm yết, mã code, danh mục, đơn vị tính.

### U. Chốt ca cá nhân (`GET /api/v1/invoices/summary?date=...&staffId=me`)
- **Quyền:** `ADMIN`, `RECEPTIONIST`.
- Khi truyền `staffId=me` (hoặc userId): trả về tổng tiền thực thu theo phương thức (`CASH`, `CREDIT_CARD`, `BANK_TRANSFER`), số hóa đơn đã xuất trong ca và số hóa đơn chưa thu còn tồn đọng.

### V. Đổi phòng cho khách lưu trú (`POST /api/v1/bookings/:id/change-room`)
- **Quyền:** `ADMIN`, `RECEPTIONIST`.
- **Body:** `{ newRoomId: string, reason: string, keepPrice?: boolean }`.
- **Ràng buộc:** Đơn phải `CHECKED_IN`, phòng mới phải `AVAILABLE` và không xung đột lịch. Phòng cũ chuyển `CLEANING`, phòng mới chuyển `OCCUPIED`.

### W. Hoàn tiền hóa đơn (`POST /api/v1/invoices/:id/refund`)
- **Quyền:** `ADMIN`, `RECEPTIONIST`.
- **Body:** `{ amount: number, reason: string }`.
- **Ràng buộc:** `amount <= paidAmount`. Hóa đơn giảm `paidAmount`, cập nhật `paymentStatus` sang `REFUNDED` hoặc `PARTIAL`.

### X. Khách gọi dịch vụ phòng & Lễ tân xử lý (`/api/v1/bookings/:id/...`)
- **Gọi dịch vụ:** `POST /api/v1/bookings/:id/service-requests` (Khách hàng gọi khi đang `CHECKED_IN`). Đơn lưu ở trạng thái `REQUESTED`.
- **Xử lý yêu cầu:** `PATCH /api/v1/bookings/:id/services/:orderId` (Lễ tân duyệt `CONFIRMED` hoặc từ chối `REJECTED`). Chỉ dịch vụ `CONFIRMED` mới được cộng vào hóa đơn thanh toán khi check-out.

### Y. Danh sách tài khoản cập nhật realtime (`GET /api/v1/users/stream`)
`GET /api/v1/users` luôn đọc trực tiếp từ PostgreSQL (không cache), nên **mọi lần gọi lại đều có tài khoản vừa đăng ký**.
Thứ còn thiếu là cơ chế *đẩy*: trước đây FE phải F5 hoặc tự gọi lại API mới thấy người mới. Endpoint SSE này lấp chỗ đó.

- **Quyền:** `ADMIN`, `RECEPTIONIST`.
- **Kiểu trả về:** `text/event-stream` (kết nối mở liên tục, không phải request-response thường).
- **Xác thực:** `EventSource` của trình duyệt không gửi được header `Authorization`, nên endpoint chấp nhận token qua query string:
  `GET /api/v1/users/stream?token=<accessToken>`. Các endpoint khác vẫn nên dùng header `Authorization: Bearer` như cũ.

| Tên sự kiện | Khi nào phát | `data` |
|---|---|---|
| `ready` | Ngay khi kết nối thành công | `{ message, at }` |
| `user.created` | Có tài khoản mới (khách tự đăng ký qua `POST /auth/register` **hoặc** admin tạo qua `POST /users`) | `{ type, source, user, emittedAt }` |
| `user.updated` | `PATCH /users/:id` hoặc `PATCH /users/me` | `{ type, source, user, emittedAt }` |
| `user.deactivated` | `DELETE /users/:id` (khóa tài khoản) | `{ type, source, user, emittedAt }` |
| `ping` | Mỗi 20 giây, giữ kết nối sống qua proxy | `{ at }` |

Trường `user` gồm `{ id, email, fullName, phone, avatar, role, isActive, createdAt }` — không bao giờ chứa mật khẩu.

**Ví dụ tích hợp FE:**
```js
const es = new EventSource(`${API_URL}/users/stream?token=${accessToken}`);

es.addEventListener('user.created', (e) => {
  const { user } = JSON.parse(e.data);
  setUsers((prev) => [user, ...prev.filter((u) => u.id !== user.id)]);
  toast.success(`Tài khoản mới: ${user.fullName} (${user.email})`);
});

es.addEventListener('user.updated', (e) => {
  const { user } = JSON.parse(e.data);
  setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...user } : u)));
});

es.addEventListener('user.deactivated', (e) => {
  const { user } = JSON.parse(e.data);
  setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: false } : u)));
});

// Nhớ đóng khi rời trang
return () => es.close();
```
> Nếu chỉ muốn đơn giản: bắt sự kiện bất kỳ rồi gọi lại `GET /api/v1/users` để nạp lại toàn bộ danh sách.

**Cơ chế bên trong:** sự kiện phát ra từ hai nguồn và tự chống trùng theo `user.id`:
1. `source: "app"` — phát ngay lập tức (độ trễ ~0) khi chính tiến trình này tạo/sửa tài khoản.
2. `source: "db-watcher"` — vòng quét CSDL mỗi 15 giây, **chỉ chạy khi đang có client lắng nghe**, để bắt tài khoản sinh ra ngoài tiến trình (deploy nhiều instance, seed, thao tác thẳng vào CSDL). Đổi bằng biến môi trường `USER_EVENTS_POLL_MS`, đặt `0` để tắt hẳn.

### Y2. Danh sách người dùng & phân trang (`GET /api/v1/users`)

Quyền: `ADMIN`, `RECEPTIONIST` (lễ tân chỉ đọc).

| Query param | Kiểu | Ghi chú |
|---|---|---|
| `role` | enum `Role` | Lọc theo vai trò: `ADMIN`, `RECEPTIONIST`, `CUSTOMER` |
| `search` | string | Tìm kiếm không phân biệt hoa thường theo `fullName`, `email`, `phone` |
| `page` | number | Trang cần lấy (mặc định 1) |
| `limit` | number | Số người dùng mỗi trang (mặc định 20, tối đa 100) |

- Cấu trúc response:
```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "data": [
      {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "email": "reception@hotel.com",
        "fullName": "Lê Thu Hà (Lễ Tân)",
        "phone": "0903334455",
        "avatar": "https://images.unsplash.com/...",
        "role": "RECEPTIONIST",
        "isActive": true,
        "createdAt": "2026-09-03T07:00:00.000Z",
        "_count": { "bookings": 4 }
      }
    ],
    "meta": {
      "total": 13,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```
*Tương thích ngược:* Không truyền `page`/`limit` thì `data.data` chứa toàn bộ tài khoản và `meta.limit = meta.total`.

---

### Z. Trạng thái phòng cập nhật realtime (`GET /api/v1/rooms/stream`)
`GET /api/v1/rooms` trả về sơ đồ phòng hiện tại. Endpoint SSE này cung cấp luồng đẩy trực tiếp: bất cứ khi nào trạng thái phòng thay đổi (khách check-in, check-out, buồng phòng dọn xong, lễ tân đổi phòng, bảo trì), màn hình ma trận phòng của Lễ tân / Quản lý / Ứng dụng khách hàng sẽ **tự động cập nhật màu sắc và trạng thái phòng ngay lập tức mà không cần F5**.

- **Quyền:** Công khai (`@Public()`) kết hợp nhận diện tài khoản tùy chọn.
  - **Nhân viên (`ADMIN`, `RECEPTIONIST`):** Nhận toàn bộ sự kiện của tất cả phòng, bao gồm cả các phòng nội bộ chờ duyệt (`PENDING_APPROVAL`) hoặc bị từ chối (`REJECTED`).
  - **Khách hàng (`CUSTOMER`) / Khách vãng lai:** Hệ thống tự động lọc bỏ các phòng nội bộ, chỉ gửi sự kiện cho các phòng hoạt động bình thường (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `MAINTENANCE`).
- **Kiểu trả về:** `text/event-stream` (kết nối mở liên tục).
- **Xác thực:** Chấp nhận token qua query string `GET /api/v1/rooms/stream?token=<accessToken>` hoặc header `Authorization: Bearer <accessToken>`.

| Tên sự kiện | Khi nào phát | `data` |
|---|---|---|
| `ready` | Ngay khi mở luồng thành công | `{ message, at }` |
| `room.status_changed` | Trạng thái phòng thay đổi: check-in (`OCCUPIED`), check-out (`CLEANING`), dọn xong (`AVAILABLE`), bảo trì (`MAINTENANCE`), xác nhận giữ chỗ (`RESERVED`), v.v. | `{ type, source, room, emittedAt }` |
| `room.created` | Admin hoặc nhân viên thêm phòng mới | `{ type, source, room, emittedAt }` |
| `room.updated` | Sửa thông tin phòng (loại phòng, tiện ích, ghi chú, giá) | `{ type, source, room, emittedAt }` |
| `room.deleted` | Admin xóa phòng | `{ type, source, room, emittedAt }` |
| `ping` | Giữ kết nối sống mỗi 20 giây qua proxy / load balancer | `{ at }` |

Trường `room` trong `room.status_changed` gồm:
```json
{
  "id": "3f6c8d20-41ab-4f27-96a8-208935cba48b",
  "roomNumber": "101",
  "floor": 1,
  "status": "OCCUPIED",
  "previousStatus": "AVAILABLE",
  "roomTypeId": "d9e03d76-e17f-4f05-896c-b3a167cf7564",
  "roomTypeName": "Phòng Deluxe Hướng Biển",
  "roomTypeCode": "DELUXE_OCEAN",
  "pricePerNight": 1200000,
  "notes": null,
  "updatedAt": "2026-09-05T08:30:00.000Z"
}
```

**Ví dụ tích hợp trên Web (JavaScript / React):**
```js
const es = new EventSource(`${API_URL}/rooms/stream?token=${accessToken}`);

es.addEventListener('room.status_changed', (e) => {
  const { room } = JSON.parse(e.data);
  console.log(`Phòng ${room.roomNumber} đổi trạng thái từ ${room.previousStatus} sang ${room.status}`);
  
  // Cập nhật ô phòng trên ma trận sơ đồ phòng
  setRooms((prev) =>
    prev.map((r) => (r.id === room.id ? { ...r, status: room.status, ...room } : r))
  );
});

es.addEventListener('room.created', (e) => {
  const { room } = JSON.parse(e.data);
  setRooms((prev) => [...prev, room]);
});

es.addEventListener('room.deleted', (e) => {
  const { room } = JSON.parse(e.data);
  setRooms((prev) => prev.filter((r) => r.id !== room.id));
});

// Hủy đăng ký khi unmount
return () => es.close();
```

**Ví dụ tích hợp trên Flutter (Dart):**
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

final client = http.Client();
final request = http.Request('GET', Uri.parse('$apiUrl/rooms/stream?token=$accessToken'));
request.headers['Accept'] = 'text/event-stream';

final response = await client.send(request);
response.stream.transform(utf8.decoder).transform(const LineSplitter()).listen((line) {
  if (line.startsWith('data:')) {
    final jsonStr = line.substring(5).trim();
    final data = jsonDecode(jsonStr);
    if (data['type'] == 'room.status_changed') {
      final room = data['room'];
      // Cập nhật State trong RoomMatrixCubit / Bloc
    }
  }
});
```

**Cơ chế bên trong:**
1. `source: "app"` — Phát tức thì (< 5ms) khi bất kỳ endpoint nào làm đổi trạng thái phòng:
   - `PATCH /rooms/:id/status` (Lễ tân đổi trạng thái thủ công)
   - `POST /bookings/:id/check-in` (Phòng chuyển `OCCUPIED`)
   - `POST /bookings/:id/check-out` (Phòng chuyển `CLEANING`)
   - `POST /bookings/:id/change-room` (Phòng cũ sang `CLEANING`, phòng mới sang `OCCUPIED`)
   - `POST /rooms/sync-status` (Đồng bộ toàn bộ phòng theo lịch)
   - Xác nhận đơn, hủy đơn, từ chối đơn làm đổi trạng thái suy diễn.
2. `source: "db-watcher"` — Vòng quét CSDL (mặc định 15 giây qua `ROOM_EVENTS_POLL_MS`) tự động bật khi có người mở kết nối và tắt khi hết client, tự động nhận diện thay đổi từ bên ngoài và tự chống phát trùng lặp.

---

### Z2. Cập nhật thông tin phòng (Chỉ Admin) (`PATCH` / `PUT /api/v1/rooms/:id`)

Dành riêng cho vai trò `ADMIN` quản lý toàn diện thông tin buồng phòng. Hỗ trợ song song cả hai method HTTP `PATCH` và `PUT`.

- **Quyền:** `ADMIN`. Nhân viên `RECEPTIONIST` và khách hàng `CUSTOMER` gọi sẽ nhận lỗi `403 Forbidden`.
- **Headers:** `Authorization: Bearer <adminAccessToken>`
- **URL Params:** `id`: UUID của phòng cần cập nhật (ví dụ: `3f6c8d20-41ab-4f27-96a8-208935cba48b`).

#### Request Body (JSON) — Tất cả các trường đều là tùy chọn (Optional):

```json
{
  "roomNumber": "101",
  "floor": 1,
  "roomTypeId": "d9e03d76-e17f-4f05-896c-b3a167cf7564",
  "roomTypeCode": "DELUXE_OCEAN",
  "roomTypeName": "Phòng Deluxe Hướng Biển",
  "status": "AVAILABLE",
  "notes": "Phòng view sân vườn, cạnh lối thoát hiểm",
  "pricePerNight": 1350000,
  "price": 1350000,
  "description": "Phòng cao cấp ngắm trọn bình minh trên biển",
  "images": [
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
  ],
  "image": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
  "amenities": ["Wifi tốc độ cao", "Ban công view biển", "Bồn tắm nằm", "Smart TV 55 inch"],
  "sizeSqM": 38,
  "capacityAdults": 2,
  "capacityChildren": 1
}
```

#### Quy tắc nghiệp vụ và ràng buộc:
1. **Kiểm tra trùng lặp số phòng:** Nếu đổi `roomNumber` sang số khác mà số phòng mới đó đã tồn tại trong khách sạn -> trả về lỗi `409 Conflict` (`"Số phòng ... đã tồn tại"`).
2. **Kiểm tra loại phòng:** Nếu truyền `roomTypeId`, `roomTypeCode` hoặc `roomTypeName`, hệ thống sẽ kiểm tra hạng phòng trong CSDL; nếu không tìm thấy -> trả về lỗi `404 Not Found`.
3. **Bóc tách tự động giữa Phòng & Hạng phòng:**
   - Các trường thuộc thực thể phòng (`roomNumber`, `floor`, `roomTypeId`, `status`, `notes`) được cập nhật trực tiếp vào bảng `rooms`.
   - Các trường thuộc hạng phòng (`pricePerNight`, `images`, `amenities`, `description`, `sizeSqM`, `capacityAdults`, `capacityChildren`) được cập nhật trực tiếp vào bảng `room_types` tương ứng, không bị lỗi schema.
4. **Đồng bộ đa tầng tức thì:**
   - Xóa sạch cache Redis phòng (`cache:rooms:*`).
   - Cập nhật chỉ mục Elasticsearch của phòng (`hotel_rooms`).
   - Phát sự kiện SSE realtime: `room.updated` và `room.status_changed` (nếu trạng thái phòng thay đổi) tới tất cả các client Web/App đang kết nối `/rooms/stream`.

#### Response thành công (`200 OK`):

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "id": "3f6c8d20-41ab-4f27-96a8-208935cba48b",
    "roomNumber": "101",
    "floor": 1,
    "status": "AVAILABLE",
    "notes": "Phòng view sân vườn, cạnh lối thoát hiểm",
    "roomTypeId": "d9e03d76-e17f-4f05-896c-b3a167cf7564",
    "roomTypeName": "Phòng Deluxe Hướng Biển",
    "roomTypeCode": "DELUXE_OCEAN",
    "description": "Phòng cao cấp ngắm trọn bình minh trên biển",
    "pricePerNight": 1350000,
    "image": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    "imageUrl": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    "images": [
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
    ],
    "amenities": [
      "Wifi tốc độ cao",
      "Ban công view biển",
      "Bồn tắm nằm",
      "Smart TV 55 inch"
    ],
    "capacityAdults": 2,
    "capacityChildren": 1,
    "capacity": 3,
    "sizeSqM": 38,
    "area": 38,
    "rating": 4.8,
    "reviewCount": 38,
    "bedType": "1 Giường đôi Queen Size (1.6m x 2.0m)",
    "viewType": "Hướng biển trực diện (Ocean View)",
    "highlights": [
      "Ban công riêng nhìn thẳng ra biển",
      "Bồn tắm nằm ngắm hoàng hôn",
      "Hệ thống đèn thông minh điều chỉnh theo tâm trạng",
      "Miễn phí bữa sáng buffet và đồ uống chào mừng"
    ]
  }
}
```

#### Các mã lỗi thường gặp:
- `400 Bad Request`: Định dạng dữ liệu không hợp lệ.
- `401 Unauthorized`: Chưa đăng nhập hoặc token đã hết hạn.
- `403 Forbidden`: Tài khoản không có vai trò `ADMIN`.
- `404 Not Found`: Không tìm thấy phòng hoặc loại phòng tương ứng.
- `409 Conflict`: Số phòng cập nhật bị trùng với phòng khác trong hệ thống.

