# Kế hoạch Backend cho đợt thiết kế lại giao diện

BE: NestJS + Prisma + PostgreSQL tại `D:\duan\Hotel-Management`
FE: Flutter tại `D:\duan\hotel_app`

Tài liệu này liệt kê **chỉ những gì BE phải làm** để 10 màn hình mới chạy được bằng dữ liệu thật. Mỗi mục ghi rõ: vì sao cần, hiện trạng, và cách sửa.

---

## P0 — Bốn việc bắt buộc (3 lỗi thật + 1 việc chặn thiết kế)

### BE-1. `/analytics/dashboard` sai hợp đồng dữ liệu — Dashboard Admin đang hiển thị số giả

**Hiện trạng.** BE trả về cấu trúc lồng:

```jsonc
{ "rooms": { "total": 20, "available": 6, "occupied": 14,
             "cleaning": 2, "maintenance": 1, "occupancyRate": "70.0%" },
  "todayActivity": { "expectedCheckIns": 3, "expectedCheckOuts": 2, "activeBookings": 9 },
  "totalRevenue": 128500000 }
```

FE lại đọc key phẳng: `data['occupancyRate']`, `data['totalRooms']`, `data['occupiedRooms']`, `data['availableRooms']`.

**Hệ quả.** Không key nào khớp, nên `admin_dashboard_screen.dart` luôn rơi vào giá trị mặc định: hiển thị **`0%`**, **`20`**, **`0`**, **`0`** bất kể dữ liệu thật là gì. Màn Dashboard hiện tại đang hiển thị số bịa.

**Lỗi phụ.** `occupancyRate` là **chuỗi** đã kèm `%` (`"70.0%"`), FE nối thêm `%` nữa. Kiểu dữ liệu nên là số để FE tự định dạng và để vẽ vòng cung đo.

**Cách sửa.** Trả về hợp đồng phẳng, số là số:

```ts
return {
  totalRooms, availableRooms, occupiedRooms, reservedRooms,
  cleaningRooms, maintenanceRooms,
  occupancyRate,          // number: 70.0  — KHÔNG kèm dấu %
  todayCheckIns, todayCheckOuts, activeBookings,
  todayRevenue,           // xem BE-6
  revenueChangePercent,   // xem BE-6
  pendingBookings, unpaidInvoices,
};
```

Nếu muốn giữ tương thích ngược cho client cũ thì trả cả hai: giữ nguyên khối lồng và thêm các key phẳng ở cấp gốc.

---

### BE-2. Analytics đếm thiếu trạng thái `RESERVED`

**Hiện trạng.** `getDashboardOverview()` đếm 4 trong 5 trạng thái: `AVAILABLE`, `OCCUPIED`, `CLEANING`, `MAINTENANCE`. Thiếu `RESERVED`.

**Hệ quả.** `total ≠ available + occupied + cleaning + maintenance`. Phòng đã đặt cọc biến mất khỏi mọi thống kê. Biểu đồ cơ cấu phòng của màn Dashboard mới có 5 đoạn — thiếu một đoạn thì thanh không đủ 100%.

**Cách sửa.** Thêm một `this.prisma.room.count({ where: { status: RoomStatus.RESERVED } })` vào mảng `Promise.all` và trả `reservedRooms`.

---

### BE-3. Ảnh và tiện ích phòng không bao giờ tới được app

Đây là việc **chặn** — thiết kế mới lấy ảnh phòng làm nhân vật chính ở toàn bộ phía khách hàng (Trang chủ, Tìm kiếm, Chi tiết).

**Hiện trạng.** Ba vấn đề chồng nhau:

1. Trong Prisma, `images` và `amenities` thuộc `RoomType`, **không** thuộc `Room`. `/rooms` trả `room.roomType.images`, nhưng `RoomModel.fromJson` của FE đọc `json['images']` ở cấp gốc → mảng luôn rỗng.
2. `/rooms/search` trả về **hai hình dạng khác nhau** tùy Elasticsearch có bật hay không:
   - ES bật: object phẳng `{ id, roomNumber, floor, status, roomTypeName, basePrice, amenities, ... }` — **không có `roomType`, không có `images`**.
   - ES tắt: object Prisma `{ ...room, roomType: { ... } }`.
3. Dữ liệu ảnh thật thì **đã có sẵn** — `prisma/seed.ts` đã gieo URL Unsplash cho cả 5 hạng phòng. Chỉ là không endpoint nào đưa nó ra đúng chỗ.

**Cách sửa.** Viết **một** mapper dùng chung, áp cho cả 4 đường ra phòng (`findAll`, `findOne`, `findAvailable`, `search`):

```ts
// src/rooms/dto/room-response.dto.ts
export function toRoomResponse(room: Room & { roomType: RoomType }) {
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    floor: room.floor,
    status: room.status,
    notes: room.notes,
    // --- phẳng hóa từ roomType để FE dùng trực tiếp ---
    roomTypeId: room.roomTypeId,
    roomTypeName: room.roomType.name,
    roomTypeCode: room.roomType.code,
    description: room.roomType.description,
    pricePerNight: room.roomType.basePrice,
    images: room.roomType.images,          // ← thứ FE đang thiếu
    amenities: room.roomType.amenities,    // ← thứ FE đang thiếu
    capacityAdults: room.roomType.capacityAdults,
    capacityChildren: room.roomType.capacityChildren,
    sizeSqM: room.roomType.sizeSqM,
  };
}
```

Sau khi có mapper, **mọi endpoint phòng trả đúng một hình dạng** — FE viết một `RoomModel.fromJson` là dùng được ở cả 4 chỗ.

---

### BE-4. Trường `avatar` có trong DB nhưng không endpoint nào trả về

**Hiện trạng.** `User.avatar` tồn tại trong schema và `seed.ts` đã gieo URL ảnh thật cho cả 13 tài khoản. Nhưng `login`, `refreshToken` và `getProfile` đều dựng payload user thủ công và **không** đưa `avatar` vào.

**Hệ quả.** Màn Hồ sơ và ảnh đại diện ở Trang chủ chỉ hiển thị được chữ cái đầu của tên.

**Cách sửa.** Thêm `avatar: user.avatar` vào cả ba payload (`auth.service.ts`: hàm `login`, `refreshToken`, và `select` của `getProfile`). Sửa 3 dòng.

---

## P1 — Endpoint mới cho màn hình đã thiết kế lại

### BE-5. Doanh thu theo ngày: `GET /analytics/revenue/daily?days=7`

**Vì sao.** Dashboard mới có biểu đồ đường doanh thu 7 ngày gần nhất. Endpoint `/analytics/revenue` hiện chỉ tổng hợp **theo tháng của một năm** — không dùng được.

**Trả về.**

```jsonc
{ "days": 7,
  "series": [ { "date": "2026-08-28", "label": "T5", "revenue": 96200000, "invoiceCount": 4 },
              { "date": "2026-08-29", "label": "T6", "revenue": 112400000, "invoiceCount": 6 } ],
  "total": 742300000, "average": 106042857,
  "peak": { "date": "2026-09-02", "revenue": 141900000 } }
```

**Lưu ý triển khai.** Gộp theo `paidAt` với `paymentStatus: PAID`. **Phải trả đủ 7 phần tử**, ngày không có hóa đơn thì `revenue: 0` — thiếu ngày sẽ làm biểu đồ nhảy khoảng cách trục.

---

### BE-6. Bổ sung số liệu cho phần đầu Dashboard và các huy hiệu đếm

Thiết kế mới hiển thị: con số chủ đạo **doanh thu hôm nay**, huy hiệu **+12,4% so với hôm qua**, và các huy hiệu đếm **"4 đơn chờ duyệt"**, **"4 hóa đơn chờ thu"**.

Thêm vào `/analytics/dashboard`:

| Trường | Ý nghĩa |
|---|---|
| `todayRevenue` | tổng `paidAmount` của hóa đơn có `paidAt` trong hôm nay |
| `yesterdayRevenue` | như trên, cho hôm qua |
| `revenueChangePercent` | số, có thể âm; `null` khi hôm qua bằng 0 (FE ẩn huy hiệu) |
| `pendingBookings` | `booking.count({ status: PENDING })` |
| `unpaidInvoices` | `invoice.count({ paymentStatus: { in: [UNPAID, PARTIAL] } })` |

`totalRevenue` hiện tại đang tính **toàn bộ lịch sử**, không phải hôm nay — giữ nguyên nhưng đừng dùng cho con số chủ đạo.

---

### BE-7. Tham số lọc và sắp xếp cho màn Tìm kiếm

Màn Tìm kiếm mới có hàng chip lọc: *Còn trống · Giá thấp nhất · Tầng cao · Có ban công · Bể bơi riêng*.

`SearchRoomDto` hiện có `q`, `minPrice`, `maxPrice`, `amenities`. Cần thêm:

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `sort` | enum `PRICE_ASC` / `PRICE_DESC` / `FLOOR_DESC` | |
| `floor` | number | lọc theo tầng |
| `status` | enum `RoomStatus` | bỏ ràng buộc cứng `AVAILABLE` ở nhánh fallback |

Nhánh fallback Postgres đang **ép cứng** `status: AVAILABLE`, nên chip "Còn trống" không thể tắt được.

---

## P2 — Chất lượng, làm sau khi P0/P1 xong

### BE-8. Elasticsearch chỉ trả `id`, dữ liệu hydrate lại từ Postgres

Thay vì để ES tự dựng object (dẫn tới hình dạng thứ hai như BE-3 mô tả), cho ES trả danh sách `id` theo đúng thứ tự liên quan, rồi `findMany({ where: { id: { in: ids } } })` và map qua `toRoomResponse()`. Một nguồn sự thật cho hình dạng dữ liệu, và ảnh không bao giờ bị thiếu ở kết quả tìm kiếm.

### BE-9. Phân trang cho danh sách

`/rooms`, `/bookings`, `/invoices` hiện trả về **toàn bộ** bản ghi. Với dữ liệu demo thì không sao, nhưng danh sách hóa đơn sẽ phình theo thời gian. Thêm `?page=&limit=` trả `{ items, total, page, limit }`.

### BE-10. Cân nhắc lại `@Public()` trên `/rooms`

`/rooms` và `/rooms/:id` đang mở công khai — hợp lý cho trang tìm phòng trước khi đăng nhập. Nhưng `notes` (ghi chú nội bộ của phòng) cũng lộ ra theo. Mapper ở BE-3 nên **bỏ `notes`** khỏi response công khai, chỉ trả cho ADMIN/RECEPTIONIST.

---

## Đã đúng — không cần đụng vào

| Hạng mục | Ghi chú |
|---|---|
| Phân quyền danh sách đơn phòng | `bookings.controller.ts` đã ép `customerId = userId` khi role là `CUSTOMER`. Khách không xem được đơn của người khác. Đúng. |
| Vỏ response | `TransformInterceptor` trả `{ statusCode, success, data, timestamp }` nhất quán toàn hệ thống, khớp `ApiResponse` của FE. |
| `bookingCode`, `invoiceCode` | BE đã trả đầy đủ. FE đang tự cắt `id.substring(0, 8)` thay vì dùng — **việc của FE**, không phải BE. |
| Ghi nhận thanh toán | `recordPayment` tính `PARTIAL` / `PAID` đúng, có ghi `issuedById` và `paidAt`. |
| Redis cache + invalidate | `delByPattern('cache:rooms:*')` đã gọi ở mọi chỗ ghi. |

---

## Ranh giới FE / BE

| Vấn đề | Ai sửa |
|---|---|
| Dashboard hiển thị 0% / 20 / 0 / 0 | **BE** đổi hợp đồng (BE-1), FE đọc lại theo hợp đồng mới |
| Thiếu đếm phòng `RESERVED` | **BE** (BE-2) |
| Card phòng không có ảnh | **BE** phẳng hóa `images` (BE-3); FE dựng `cached_network_image` + ảnh dự phòng khi mảng rỗng |
| Ảnh đại diện chỉ có chữ cái | **BE** trả `avatar` (BE-4); FE hiển thị |
| Biểu đồ doanh thu 7 ngày | **BE** endpoint mới (BE-5); FE vẽ bằng `fl_chart` |
| Hóa đơn hiển thị `#a1b2c3d4` thay vì `#INV-0241` | **FE** — BE đã trả `invoiceCode` |
| Trạng thái đơn hiện chữ `CHECKED_IN` thô | **FE** — ánh xạ sang nhãn tiếng Việt bằng enum, không cần BE |
| Skeleton loading, empty state, dark mode | **FE** hoàn toàn |

---

## Thứ tự làm đề xuất

1. **BE-1 + BE-2 + BE-4** — cùng chạm vào `analytics.service.ts` và `auth.service.ts`, sửa nhanh, gỡ ngay số liệu giả trên Dashboard.
2. **BE-3** — mapper phòng. Việc lớn nhất trong nhóm P0 và là thứ chặn toàn bộ phía khách hàng.
3. **BE-5 + BE-6** — bổ sung số liệu, làm một lượt trong `analytics.service.ts`.
4. **BE-7** — tham số tìm kiếm.
5. P2 khi có thời gian.

Bước 1 và 2 độc lập nhau nên có thể làm song song. FE không bị chặn: các màn Splash / Đăng nhập / Đăng ký / Hồ sơ / Sơ đồ phòng đều dựng được ngay bằng dữ liệu hiện có.
