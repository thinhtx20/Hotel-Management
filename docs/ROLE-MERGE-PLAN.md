# Gộp vai trò Lễ tân + Thu ngân · Dọn tab trùng · Bổ sung chức năng theo vai trò

> **Phạm vi:** Backend `D:\duan\Hotel-Management` (NestJS + Prisma) và Frontend `D:\duan\hotel_app` (Flutter).
> **Thay thế:** phần 4 và 5 của [`design/FE-ROLE-MATRIX.md`](../../hotel_app/design/FE-ROLE-MATRIX.md) (bên FE) sau khi triển khai xong.
> **Ngày lập:** 2026-09-05 · Trạng thái: đề xuất, chờ chốt.

Tài liệu trả lời đúng 3 câu hỏi:

1. Gộp `RECEPTIONIST` + `CASHIER` thành một vai trò thì BE và FE phải sửa những gì?
2. Tab nào đang trùng chức năng giữa các vai trò, bỏ tab nào, chức năng đó chuyển đi đâu?
3. Sau khi dọn, mỗi vai trò được thêm chức năng gì để tab không bị rỗng và đúng nghiệp vụ?

---

## 0. Tóm tắt trong 1 phút

| Quyết định | Nội dung |
|---|---|
| **Đ1 — Tên vai trò sau gộp** | Giữ nguyên enum `RECEPTIONIST`, chỉ đổi **nhãn hiển thị** thành **"Lễ tân – Thu ngân"**. Xóa hẳn `CASHIER` khỏi enum. |
| **Đ2 — Số vai trò** | 4 → **3**: `ADMIN`, `RECEPTIONIST` (Lễ tân – Thu ngân), `CUSTOMER`. |
| **Đ3 — Nguyên tắc dọn tab** | *Một chức năng — một chủ sở hữu tab.* Vai trò khác vẫn dùng được chức năng đó nhưng qua đường dẫn phụ (drill-down / segment / filter), không chiếm một tab riêng. |
| **Đ4 — Số tab sau dọn** | ADMIN 5 tab · LỄ TÂN–THU NGÂN 5 tab · KHÁCH 4 tab. Không còn màn hình nào là tab của ≥2 vai trò (trừ **Hồ sơ**). |
| **Đ5 — Chức năng mới** | 4 cho ADMIN, 5 cho LỄ TÂN–THU NGÂN, 4 cho KHÁCH — chia P1 (làm ngay) / P2 (đợt sau), xem [§3.6](#36-endpoint-mới-theo-vai-trò) và [§4.4](#44-màn-hình-mới-cần-tạo-fe). |

**Vì sao giữ `RECEPTIONIST` mà không đặt tên mới `STAFF`?**
BE hiện có **35 decorator `@Roles`, trong đó 25 dòng nhắc `RECEPTIONIST` và 9 dòng nhắc `CASHIER`**. Đổi sang `STAFF` phải sửa cả 25 dòng kia, migrate cả hàng `RECEPTIONIST` lẫn `CASHIER`, và sửa mọi so sánh role bên FE. Giữ `RECEPTIONIST` thì migration chỉ chạm các hàng `role = 'CASHIER'` (hiện 2 tài khoản seed), và 9 dòng `@Roles` chỉ cần **xóa bớt một phần tử**. Nếu vẫn muốn tên mới, làm sau khi đợt này chạy ổn: thêm `UPDATE users SET role='STAFF'` và một lần rename toàn cục — không ảnh hưởng thiết kế tab ở §4.

---

## 1. Hiện trạng và các chỗ trùng

### 1.1 Bộ tab đang chạy

Nguồn: [`lib/core/router/app_router.dart`](../../hotel_app/lib/core/router/app_router.dart) — 4 `StatefulShellRoute`.

| Vai trò | Tab hiện tại | Màn hình thật đằng sau |
|---|---|---|
| `ADMIN` | Tổng quan · Duyệt phòng · Sơ đồ phòng · **Thu ngân** · Hồ sơ | `AdminDashboardScreen` · `RoomApprovalScreen` · `RoomMatrixScreen` · `CashierInvoicesScreen` · `ProfileScreen` |
| `RECEPTIONIST` | Sơ đồ phòng · Duyệt đơn · **Tổng quan** · **Hóa đơn** · Hồ sơ | `RoomMatrixScreen` · `BookingApprovalScreen` · `AdminDashboardScreen` · `CashierInvoicesScreen` · `ProfileScreen` |
| `CASHIER` | **Hóa đơn** · **Tổng quan** · Trả phòng · Hồ sơ | `CashierInvoicesScreen` · `AdminDashboardScreen` · `TodayCheckOutsScreen` · `ProfileScreen` |
| `CUSTOMER` | Khám phá · **Tìm kiếm** · Đơn phòng · **Hóa đơn của tôi** · Tài khoản | `CustomerHomeScreen` · `RoomSearchScreen` · `MyBookingsScreen` · `MyInvoicesScreen` · `ProfileScreen` |

### 1.2 Bảng trùng — cùng một widget được gắn làm tab của nhiều vai trò

| Màn hình | Đang là tab của | Số lần lặp |
|---|---|:--:|
| `AdminDashboardScreen` | ADMIN, RECEPTIONIST, CASHIER | **3** |
| `CashierInvoicesScreen` | ADMIN, RECEPTIONIST, CASHIER | **3** |
| `RoomMatrixScreen` | ADMIN, RECEPTIONIST | **2** |
| `TodayCheckOutsScreen` | CASHIER (tab) + `/staff/today-check-outs` (route dùng chung) | **2 lối vào** |
| `BookingApprovalScreen` | RECEPTIONIST (tab) + `/staff/pending-bookings` | **2 lối vào** |
| `RoomApprovalScreen` | ADMIN (tab) + `/room-approval` | **2 lối vào** |
| `ProfileScreen` | cả 4 vai trò | Chấp nhận được — hồ sơ là của từng người, không phải chức năng nghiệp vụ. |

### 1.3 Vì sao hai vai trò Lễ tân / Thu ngân đã gần như trùng nhau

Đối chiếu [`role_permissions.dart`](../../hotel_app/lib/core/constants/role_permissions.dart) với `@Roles` trong BE: hai vai trò chỉ khác nhau đúng **5 quyền**.

| Quyền | LỄ TÂN | THU NGÂN | Sau khi gộp |
|---|:--:|:--:|---|
| `POST /invoices` — tạo hóa đơn thủ công | ❌ | ✅ | ✅ (mở cho vai trò gộp) |
| `POST /bookings/:id/check-in` | ✅ | ❌ | ✅ |
| `POST /bookings/:id/services` | ✅ | ❌ | ✅ |
| `PATCH /rooms/:id/status` | ✅ | ❌ | ✅ |
| `GET /analytics/occupancy-by-type` | ✅ | ❌ | ✅ |
| 19 quyền còn lại | giống hệt nhau | | giữ nguyên |

Nghiệp vụ khách sạn quy mô này chỉ có **một quầy**: người nhận phòng cũng là người thu tiền. Duy trì hai vai trò tạo ra 2 bộ tab, 2 nhánh route, 2 nhánh test cho cùng một con người ngồi cùng một chỗ.

### 1.4 Ghi chú kỹ thuật quan trọng (đã kiểm chứng trong code)

- [`jwt.strategy.ts:33-45`](../src/auth/jwt.strategy.ts#L33-L45) **đọc `role` từ DB mỗi request**, không lấy từ payload token. ⇒ Ngay khi migration chạy xong, mọi access token cũ của thu ngân **tự động** mang quyền mới, **không cần** cơ chế alias hay ép đăng xuất toàn bộ ở BE.
- Ngược lại, FE **có cache user (kèm `role`) xuống secure storage** ([`token_storage.dart:62-73`](../../hotel_app/lib/core/storage/token_storage.dart#L62-L73)). ⇒ FE **bắt buộc** phải giữ alias `'CASHIER' → receptionist` trong `UserRole.fromString`, nếu không phiên đang đăng nhập sẽ rơi vào nhánh route đã bị xóa.
- `PaymentStatus.REFUNDED` đã có trong enum Prisma nhưng **không endpoint nào set được** — khoảng trống này trở thành chức năng mới S4.
- `/services` hiện là **mảng hard-code** trong [`services.service.ts`](../src/services/services.service.ts), không có bảng DB — trở thành chức năng mới A3.

---

## 2. Vai trò sau khi gộp

| Enum | Nhãn hiển thị | Bản chất công việc |
|---|---|---|
| `ADMIN` | Quản trị viên / Giám đốc | **Cấu hình & giám sát**: nhân sự, phòng & hạng phòng, danh mục dịch vụ, báo cáo. Không làm nghiệp vụ quầy hằng ngày. |
| `RECEPTIONIST` | **Lễ tân – Thu ngân** | **Vận hành quầy**: sơ đồ phòng, duyệt đơn, nhận/trả phòng, ghi dịch vụ, xuất hóa đơn, thu tiền, chốt ca. |
| `CUSTOMER` | Khách hàng | Tìm phòng, đặt phòng, theo dõi đơn & hóa đơn của mình, gọi dịch vụ tại phòng. |

Tài khoản demo `cashier@hotel.com` / `cashier.accounting@hotel.com` **giữ nguyên email và mật khẩu**, chỉ đổi `role` sang `RECEPTIONIST` — QA không phải học lại bộ tài khoản.

---

## 3. Phần Backend

### 3.1 Prisma schema & migration

**Sửa [`prisma/schema.prisma:14-19`](../prisma/schema.prisma#L14-L19):**

```prisma
enum Role {
  ADMIN
  RECEPTIONIST // Lễ tân – Thu ngân (gộp từ RECEPTIONIST + CASHIER, 2026-09)
  CUSTOMER
}
```

PostgreSQL không xóa được một giá trị enum tại chỗ, nên phải viết migration tay:

```bash
npx prisma migrate dev --create-only --name merge_cashier_into_receptionist
```

Rồi thay nội dung file `migration.sql` vừa sinh bằng:

```sql
-- 1. Chuyển toàn bộ tài khoản thu ngân sang lễ tân (idempotent, chạy lại vẫn an toàn)
UPDATE "users" SET "role" = 'RECEPTIONIST' WHERE "role" = 'CASHIER';

-- 2. Dựng lại kiểu enum không còn CASHIER
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RECEPTIONIST', 'CUSTOMER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
DROP TYPE "Role_old";
```

**Kiểm tra trước khi apply lên môi trường thật:**

```sql
SELECT role, COUNT(*) FROM users GROUP BY role;   -- sau migration phải không còn dòng CASHIER
```

> ⚠️ Bước 2 sẽ **fail** nếu còn bất kỳ hàng nào mang giá trị `CASHIER` — đó là lưới an toàn, không phải lỗi. Chạy lại bước 1 rồi apply tiếp.

### 3.2 Sửa `@Roles` — 9 dòng (8 nhóm)

| File | Dòng | Hiện tại | Sau khi sửa |
|---|:--:|---|---|
| [`invoices.controller.ts`](../src/invoices/invoices.controller.ts#L65) | 65 | `ADMIN, RECEPTIONIST, CASHIER` | `ADMIN, RECEPTIONIST` |
| [`invoices.controller.ts`](../src/invoices/invoices.controller.ts#L106) | 106 | `ADMIN, CASHIER` | `ADMIN, RECEPTIONIST` ← **mở quyền tạo hóa đơn thủ công cho vai trò gộp** |
| [`invoices.controller.ts`](../src/invoices/invoices.controller.ts#L121) | 121 | `ADMIN, RECEPTIONIST, CASHIER` | `ADMIN, RECEPTIONIST` |
| [`invoices.controller.ts`](../src/invoices/invoices.controller.ts#L134) | 134 | `ADMIN, RECEPTIONIST, CASHIER, CUSTOMER` | `ADMIN, RECEPTIONIST, CUSTOMER` |
| [`invoices.controller.ts`](../src/invoices/invoices.controller.ts#L167) | 167 | `ADMIN, RECEPTIONIST, CASHIER` | `ADMIN, RECEPTIONIST` |
| [`analytics.controller.ts`](../src/analytics/analytics.controller.ts#L19) | 19, 92 | `ADMIN, RECEPTIONIST, CASHIER` | `ADMIN, RECEPTIONIST` |
| [`bookings.controller.ts`](../src/bookings/bookings.controller.ts#L352) | 352 | `ADMIN, RECEPTIONIST, CASHIER` | `ADMIN, RECEPTIONIST` |
| [`rooms.controller.ts`](../src/rooms/rooms.controller.ts#L55) | 55 | `ADMIN, RECEPTIONIST, CUSTOMER, CASHIER` | `ADMIN, RECEPTIONIST, CUSTOMER` |

Lệnh soát còn sót (hiện đang có **17** dòng trong `src`, gồm cả mô tả Swagger và tài khoản seed ở §3.3):

```bash
grep -rn "CASHIER" src prisma --include="*.ts"   # phải ra 0 dòng sau khi xong
```

### 3.3 Các chỗ khác phải sửa kèm

| File | Việc |
|---|---|
| [`prisma/seed.ts:96-116`](../prisma/seed.ts#L96-L116) | `cashier1`, `cashier2` → `role: Role.RECEPTIONIST`, giữ nguyên email/tên hiển thị ("Thu ngân Quầy sảnh"). Cập nhật cả khối `console.log` cuối file (bỏ mục `[CASHIER]`, gộp vào `[LỄ TÂN – THU NGÂN]`). |
| [`prisma/seed.ts:716,753`](../prisma/seed.ts#L716) | `issuedById: cashier1.id` giữ nguyên — dữ liệu hóa đơn mẫu vẫn hợp lệ vì user chỉ đổi role. |
| [`src/prisma/prisma.service.ts:119-133`](../src/prisma/prisma.service.ts#L119-L133) | Bộ tài khoản tự tạo lúc khởi động: đổi `Role.CASHIER` → `Role.RECEPTIONIST`. |
| [`src/auth/auth.service.ts:92-97`](../src/auth/auth.service.ts#L92-L97) | Danh sách tài khoản demo đồng bộ khi login: đổi tương tự. |
| [`src/users/dto/create-user.dto.ts`](../src/users/dto/create-user.dto.ts) | Sửa mô tả Swagger: `'Vai trò được cấp: ADMIN, RECEPTIONIST hoặc CUSTOMER'`. |
| [`src/auth/dto/register.dto.ts`](../src/auth/dto/register.dto.ts) | Bỏ `CASHIER` khỏi ví dụ/mô tả (trường `role` vẫn bị server bỏ qua). |
| [`API-CONTRACT.md:919`](../API-CONTRACT.md#L919) | Cập nhật `role ∈ ADMIN | RECEPTIONIST | CUSTOMER`. |
| Swagger `@ApiOperation` | Các mô tả có chữ "Thu ngân / Kế toán" đổi thành "Lễ tân – Thu ngân" (invoices.controller.ts:168, analytics.controller.ts:23-25). |

### 3.4 Không cần làm

- ❌ Không cần alias `CASHIER → RECEPTIONIST` trong `RolesGuard`: role được nạp lại từ DB mỗi request (§1.4).
- ❌ Không cần thu hồi toàn bộ refresh token: token chỉ mang `sub`, quyền lấy theo DB.
- ❌ Không đụng tới `Invoice.issuedById` / `Booking.confirmedById`: đó là FK tới `users`, không phải role.

### 3.5 Ma trận quyền sau khi gộp

Ký hiệu: ✅ gọi được · ❌ 403 · 🔓 công khai · ⚠️ có ràng buộc, đọc ghi chú.

**Auth** — `POST /auth/*` giữ nguyên toàn bộ (🔓 với 7 endpoint, ✅ với `GET /auth/me`, `POST /auth/change-password`).

| Nhóm | Endpoint | ADMIN | LỄ TÂN–THU NGÂN | KHÁCH |
|---|---|:--:|:--:|:--:|
| **Users** | `PATCH /users/me` | ✅ | ✅ | ✅ |
| | `GET /users`, `GET /users/:id` | ✅ | ✅ (read-only) | ❌ |
| | `PATCH /users/:id`, `DELETE /users/:id` | ✅ | ❌ | ❌ |
| **Room Types** | `GET /room-types`, `/:id` | 🔓 | 🔓 | 🔓 |
| | `POST\|PATCH\|DELETE /room-types` | ✅ | ❌ | ❌ |
| **Rooms** | 4 endpoint `GET` | 🔓 ⚠️ | 🔓 ⚠️ | 🔓 |
| | `POST /rooms` | ✅ | ⚠️ ép `PENDING_APPROVAL` | ⚠️ ép `PENDING_APPROVAL` |
| | `PATCH /rooms/:id/approve\|reject` | ✅ | ✅ | ❌ |
| | `PATCH /rooms/:id/status` | ✅ | ✅ | ❌ |
| | `POST /rooms/sync-status` | ✅ | ✅ | ❌ |
| | `PATCH /rooms/:id`, `DELETE /rooms/:id` | ✅ | ❌ | ❌ |
| **Bookings** | `POST /bookings`, `GET /bookings`, `GET /bookings/:id` | ✅ | ✅ | ⚠️ chỉ đơn của mình |
| | `check-in`, `check-out`, `services`, `approve\|reject\|confirm` | ✅ | ✅ | ❌ |
| | `cancel` | ✅ | ✅ | ⚠️ chỉ đơn `PENDING` của mình |
| **Invoices** | `GET /invoices`, `/summary`, `/:id` | ✅ | ✅ | ❌ (`/:id`: ⚠️ chỉ của mình) |
| | `GET /invoices/my` | ✅ | ✅ | ✅ |
| | `POST /invoices` | ✅ | ✅ **(mới)** | ❌ |
| | `POST /invoices/:id/pay` | ✅ | ✅ | ❌ |
| **Analytics** | `GET /analytics/dashboard`, `/revenue/daily` | ✅ | ✅ | ❌ |
| | `GET /analytics/occupancy-by-type` | ✅ | ✅ | ❌ |
| | `GET /analytics/revenue?year=` | ✅ | ❌ | ❌ |
| **Upload** | `/avatar`, `/image`, `/images`, `DELETE /upload` | ✅ | ✅ | ✅ |
| | `/upload/room`, `/upload/rooms` | ✅ | ✅ | ❌ |

**Bảng tra 403 rút gọn sau gộp** — chỉ còn 4 dòng cho vai trò nhân viên (trước là 9):

| Vai trò | Endpoint | FE xử lý |
|---|---|---|
| LỄ TÂN–THU NGÂN | `GET /analytics/revenue?year=` | Không có tab Báo cáo năm |
| LỄ TÂN–THU NGÂN | `PATCH\|DELETE /rooms/:id` | Sơ đồ phòng chỉ đổi trạng thái |
| LỄ TÂN–THU NGÂN | `POST\|PATCH\|DELETE /room-types` | Không có màn hạng phòng |
| LỄ TÂN–THU NGÂN | `PATCH\|DELETE /users/:id` | Màn khách hàng read-only |

### 3.6 Endpoint mới theo vai trò

#### ADMIN

**A1 · Hiệu suất nhân viên — `GET /analytics/staff-performance?from=&to=` · P1 · không đổi schema**

Dữ liệu đã có sẵn: `Booking.confirmedById`, `Booking.cancelledById`, `Invoice.issuedById`.

```jsonc
{
  "from": "2026-09-01", "to": "2026-09-05",
  "staff": [
    { "userId": "…", "fullName": "Lê Thu Hà", "role": "RECEPTIONIST",
      "bookingsConfirmed": 34, "bookingsCancelled": 2,
      "invoicesIssued": 41, "amountCollected": 128500000 }
  ],
  "totals": { "bookingsConfirmed": 87, "invoicesIssued": 96, "amountCollected": 402100000 }
}
```

File: `src/analytics/analytics.service.ts` (thêm `getStaffPerformance`), `analytics.controller.ts` (`@Roles(Role.ADMIN)`).

**A2 · Danh mục dịch vụ có thật trong DB — `POST|PATCH|DELETE /services` · P1 · cần model mới**

Hiện `/services` trả mảng hard-code nên Admin không sửa được giá, và lễ tân ghi dịch vụ phải gõ tay `serviceName` + `unitPrice` (`POST /bookings/:id/services`) — sai giá là sai doanh thu.

```prisma
model HotelService {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  category    String   // FOOD_BEVERAGE | WELLNESS | TRANSPORT | CONVENIENCE | ROOM_SERVICE
  description String?
  unitPrice   Float
  unit        String   @default("lần")
  icon        String?
  isAvailable Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("hotel_services")
}
```

`GET /services` giữ `@Public()` và giữ **nguyên hình dạng JSON hiện tại** để FE khách hàng không phải sửa. Seed lại đúng 6 mục đang hard-code.

**A3 · Xuất báo cáo — `GET /analytics/revenue/export?year=&format=csv` · P2**
Trả `text/csv` (`Content-Disposition: attachment`), 12 dòng tháng + dòng tổng.

**A4 · Nhật ký hoạt động — `GET /audit-logs?actorId=&action=&from=&to=` · P2 · cần model mới**
Ghi lại 6 hành động nhạy cảm: đổi role, vô hiệu hóa tài khoản, duyệt/từ chối phòng, duyệt/hủy đơn, ghi nhận thanh toán, hoàn tiền.

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  actorId    String
  actor      User     @relation(fields: [actorId], references: [id])
  action     String   // ROLE_CHANGED | ROOM_APPROVED | INVOICE_PAID | INVOICE_REFUNDED | …
  targetType String   // user | room | booking | invoice
  targetId   String
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

#### LỄ TÂN – THU NGÂN

**S1 · Chốt ca / sổ quỹ cá nhân — `GET /invoices/summary?date=&staffId=me` · P1 · không đổi schema**

Mở rộng `getSummary` hiện có ([`invoices.service.ts:278`](../src/invoices/invoices.service.ts#L278)) thêm tham số `staffId`; `me` = người đang đăng nhập, lọc `issuedById`. Đây là tính năng thay cho tab "Tổng quan" bị bỏ ở §4.3.

```jsonc
{
  "date": "2026-09-05", "staffId": "…", "staffName": "Lê Thu Hà",
  "invoicesIssued": 12, "amountCollected": 18400000,
  "byMethod": { "CASH": 6200000, "CREDIT_CARD": 9100000, "BANK_TRANSFER": 3100000 },
  "unpaidLeftBehind": 2
}
```

**S2 · Đổi phòng cho khách đang lưu trú — `POST /bookings/:id/change-room` · P1**

```jsonc
// Request
{ "newRoomId": "…", "reason": "Điều hòa phòng 301 hỏng", "keepPrice": true }
```
Ràng buộc: đơn phải `CHECKED_IN`; phòng mới phải `AVAILABLE` và không trùng lịch trong khoảng còn lại; phòng cũ → `CLEANING`, phòng mới → `OCCUPIED`; nếu `keepPrice=false` thì tính lại `totalAmount` theo giá hạng phòng mới cho số đêm còn lại. Dùng lại cơ chế khóa Redis như `createBooking`.

**S3 · Gia hạn lưu trú — `PATCH /bookings/:id/extend` · P2**
`{ "newCheckOutDate": "2026-09-08" }` — kiểm tra phòng còn trống tới ngày mới, cộng tiền vào hóa đơn tạm tính.

**S4 · Hoàn tiền — `POST /invoices/:id/refund` · P1**
`PaymentStatus.REFUNDED` đang có enum mà không đường nào set. `{ "amount": 500000, "reason": "Khách trả phòng sớm 1 đêm" }` → giảm `paidAmount`, đặt `paymentStatus = REFUNDED` (hoàn toàn phần) hoặc `PARTIAL`, ghi `notes`. Chỉ hoàn được ≤ `paidAmount`.

**S5 · Đặt phòng tại quầy (walk-in) — chỉ FE, dùng `POST /bookings` sẵn có · P1**
Nhân viên tạo đơn với `customerId` của khách (hoặc `POST /users` tạo hồ sơ khách mới), BE trả `status = CONFIRMED` ngay ([`bookings.service.ts:173-175`](../src/bookings/bookings.service.ts#L173-L175)) → check-in luôn.

#### KHÁCH HÀNG

**C1 · Gọi dịch vụ tại phòng — `POST /bookings/:id/service-requests` · P1 · cần sửa model**

```prisma
model ExtraServiceOrder {
  // … các cột hiện có giữ nguyên …
  status        String   @default("CONFIRMED") // REQUESTED | CONFIRMED | REJECTED
  requestedById String?
  requestedBy   User?    @relation("ServiceRequestedBy", fields: [requestedById], references: [id])
  note          String?
}
```
Khách gọi → bản ghi `REQUESTED` (chưa vào hóa đơn). Lễ tân xác nhận qua `PATCH /bookings/:id/services/:orderId` (`CONFIRMED` → cộng vào `servicesAmount`, hoặc `REJECTED`). Chỉ cho phép khi đơn đang `CHECKED_IN` và đúng chủ đơn.

**C2 · Đổi ngày đơn — `PATCH /bookings/:id/reschedule` · P2**
Chỉ đơn `PENDING`/`CONFIRMED` của chính khách, cách ngày nhận phòng ≥ 24h, phòng phải còn trống khoảng mới; đơn `CONFIRMED` sau khi đổi quay về `PENDING` chờ lễ tân duyệt lại.

**C3 · Tải hóa đơn PDF — `GET /invoices/:id/pdf` · P2**
Dùng lại kiểm tra chủ sở hữu của `GET /invoices/:id`.

**C4 · Đánh giá sau lưu trú — `POST /bookings/:id/review`, `GET /room-types/:id/reviews` · P2 · cần model mới**

```prisma
model Review {
  id         String   @id @default(uuid())
  bookingId  String   @unique
  booking    Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  roomTypeId String
  roomType   RoomType @relation(fields: [roomTypeId], references: [id])
  authorId   String
  author     User     @relation(fields: [authorId], references: [id])
  rating     Int      // 1..5
  comment    String?
  createdAt  DateTime @default(now())

  @@index([roomTypeId])
  @@map("reviews")
}
```
Chỉ tạo được khi đơn `CHECKED_OUT`, mỗi đơn 1 lần. `GET /room-types/:id` trả thêm `averageRating`, `reviewCount` → nuôi thẳng màn chi tiết phòng bên app khách.

### 3.7 Thứ tự làm phía BE

| Bước | Việc | Kết quả kiểm chứng |
|:--:|---|---|
| 1 | Sửa 8 chỗ `@Roles` + seed + prisma.service + auth.service | `grep -rn "CASHIER" src prisma --include="*.ts"` → rỗng |
| 2 | Sửa enum + migration SQL (§3.1) | `SELECT role, COUNT(*) FROM users GROUP BY role` không còn `CASHIER` |
| 3 | `npx prisma generate` + `npm run build` | Build sạch; TypeScript sẽ tự báo mọi chỗ còn tham chiếu `Role.CASHIER` |
| 4 | Chạy seed lại trên máy dev | Đăng nhập `cashier@hotel.com` ra `role: "RECEPTIONIST"` |
| 5 | A1, A2, S1, S2, S4, C1 (nhóm P1) | Swagger `/api/docs` hiện đủ endpoint mới |
| 6 | Cập nhật `API-CONTRACT.md` + `FE-ROLE-MATRIX.md` | Doc khớp code |

---

## 4. Phần Frontend

### 4.1 Enum & bảng quyền

**[`lib/core/constants/role_enum.dart`](../../hotel_app/lib/core/constants/role_enum.dart)** — bỏ hằng `cashier`, **giữ alias trong `fromString`**:

```dart
enum UserRole {
  customer('CUSTOMER', 'Khách hàng'),
  receptionist('RECEPTIONIST', 'Lễ tân – Thu ngân'),
  admin('ADMIN', 'Quản trị viên / Giám đốc');

  static UserRole fromString(String? role) {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return UserRole.admin;
      case 'RECEPTIONIST':
      // Phiên cũ còn cache role CASHIER trong secure storage (token_storage.dart).
      // Giữ nhánh này tối thiểu 1 bản phát hành rồi mới xóa.
      case 'CASHIER':
        return UserRole.receptionist;
      case 'CUSTOMER':
      default:
        return UserRole.customer;
    }
  }
}
```

**[`role_permissions.dart`](../../hotel_app/lib/core/constants/role_permissions.dart)** — xóa `_isCashier`; 5 getter dưới đây đổi vế phải:

| Getter | Trước | Sau |
|---|---|---|
| `canCreateInvoice` | `_isAdmin \|\| _isCashier` | `isStaff` |
| `canCheckIn` | `_isAdmin \|\| _isReceptionist` | `isStaff` |
| `canAddBookingServices` | `_isAdmin \|\| _isReceptionist` | `isStaff` |
| `canChangeRoomStatus` | `_isAdmin \|\| _isReceptionist` | `isStaff` |
| `canViewOccupancy` | `_isAdmin \|\| _isReceptionist` | `isStaff` |

Thêm getter cho chức năng mới: `canRefundInvoice => isStaff`, `canChangeRoom => isStaff`, `canCloseShift => isStaff`, `canManageServiceCatalog => _isAdmin`, `canViewStaffPerformance => _isAdmin`, `canRequestService => this == UserRole.customer`.

### 4.2 Router

**[`app_router.dart`](../../hotel_app/lib/core/router/app_router.dart)** — 4 việc:

1. **Xóa toàn bộ `StatefulShellRoute` của `/cashier`** (dòng 515-589).
2. **Thêm redirect cho đường dẫn cũ** — deep link, thông báo đẩy và phiên đang mở vẫn còn giữ `/cashier…`:
   ```dart
   const Map<String, String> _legacyRedirects = {
     '/cashier': '/receptionist/invoices',
     '/cashier/dashboard': '/receptionist',        // Tổng quan đã bỏ, về Sơ đồ phòng
     '/cashier/check-outs': '/receptionist/today',
     '/cashier/profile': '/receptionist/profile',
   };
   ```
   Xử lý trong `redirect:` **trước** khi kiểm tra `_canAccess`.
3. **Cập nhật `_staffRoles`**: `{UserRole.admin, UserRole.receptionist}`, và `_sharedRouteAccess` bỏ các mục đã thành tab riêng.
4. **Đổi lại danh sách tab của 2 shell còn lại** theo §4.3.

Giữ nguyên tiền tố `/receptionist` (không đổi sang `/staff`) — nhánh này giờ thuộc về vai trò gộp. Nếu muốn đổi cho đúng nghĩa thì cũng rẻ: chỉ có **8 chỗ** trong `lib` hardcode `'/receptionist…'` (cộng `homeRoute` trong `role_permissions.dart` và các test). Làm thì làm ở P1, và nhớ giữ luôn redirect từ cả `/receptionist*` lẫn `/cashier*`.

### 4.3 Bộ tab mới — bỏ gì, chuyển đi đâu

#### Nguyên tắc: một chức năng — một chủ sở hữu tab

| Chức năng | Chủ sở hữu tab (sau) | Vai trò còn lại truy cập bằng |
|---|---|---|
| Dashboard KPI toàn khách sạn | **ADMIN** · tab Tổng quan | Lễ tân–Thu ngân: dải 4 KPI ca trực gắn trên đầu tab Sơ đồ phòng (cùng `GET /analytics/dashboard`) |
| Sơ đồ phòng vận hành | **LỄ TÂN–THU NGÂN** · tab Sơ đồ phòng | Admin: bấm thẻ "Cơ cấu phòng" ở Tổng quan → `/admin/rooms` (read-only, không nút đổi trạng thái) |
| Hóa đơn & thu tiền | **LỄ TÂN–THU NGÂN** · tab Hóa đơn | Admin: Báo cáo → "Sổ hóa đơn" (`/admin/invoices`, read-only) |
| Duyệt phòng chờ | **ADMIN** · tab Vận hành phòng, segment "Chờ duyệt" | Lễ tân–Thu ngân: chip lọc `PENDING_APPROVAL` ngay trong Sơ đồ phòng |
| Duyệt đơn đặt phòng | **LỄ TÂN–THU NGÂN** · tab Duyệt đơn | Admin: badge trên Tổng quan → `/staff/pending-bookings` |
| Nhận / trả phòng hôm nay | **LỄ TÂN–THU NGÂN** · tab Hôm nay | Admin: 2 thẻ "Khách đến / Khách đi" ở Tổng quan |
| Hồ sơ | mọi vai trò | — (ngoại lệ hợp lệ) |

#### ADMIN — 5 tab

| # | Tab | Màn hình | API |
|:--:|---|---|---|
| 0 | Tổng quan | `AdminDashboardScreen` (giữ) | `GET /analytics/dashboard`, `/analytics/occupancy-by-type` |
| 1 | **Báo cáo** 🆕 | `ReportsScreen` 🆕 | `GET /analytics/revenue?year=`, `/analytics/revenue/daily`, `/analytics/staff-performance` (A1), export CSV (A3) |
| 2 | **Vận hành phòng** ♻️ | `RoomOperationsScreen` 🆕 — 3 segment: Phòng · Hạng phòng · Chờ duyệt | `GET/POST/PATCH/DELETE /rooms`, `/room-types`, `PATCH /rooms/:id/approve\|reject` |
| 3 | **Nhân sự & Dịch vụ** ♻️ | `UserManagementScreen` (đang là route ẩn `/admin/users`) + `ServiceCatalogScreen` 🆕 dạng 2 segment | `GET/POST/PATCH/DELETE /users`, `/services` (A2) |
| 4 | Hồ sơ | `ProfileScreen` | — |

**Bỏ khỏi ADMIN:** tab **Thu ngân/Hóa đơn** (trùng với tab Hóa đơn của lễ tân) → chuyển thành route read-only trong tab Báo cáo. Tab **Sơ đồ phòng** hợp nhất vào "Vận hành phòng" (segment Phòng), tab **Duyệt phòng** thành segment thứ 3 của cùng tab đó.

#### LỄ TÂN – THU NGÂN — 5 tab

| # | Tab | Màn hình | API |
|:--:|---|---|---|
| 0 | Sơ đồ phòng | `RoomMatrixScreen` + dải KPI ca trực 🆕 | `GET /rooms`, `PATCH /rooms/:id/status`, `GET /analytics/dashboard` |
| 1 | **Hôm nay** ♻️🆕 | `FrontDeskTodayScreen` 🆕 — 2 segment gộp `TodayCheckInsScreen` + `TodayCheckOutsScreen` | `GET /bookings?checkInFrom=…`, `POST /bookings/:id/check-in\|check-out` |
| 2 | Duyệt đơn | `BookingApprovalScreen` (giữ) | `PATCH /bookings/:id/confirm\|reject`, `POST /bookings` (walk-in S5) |
| 3 | **Hóa đơn & Thu ngân** ♻️ | `CashierInvoicesScreen` + `ShiftCloseScreen` 🆕 | `GET/POST /invoices`, `POST /invoices/:id/pay`, `/refund` (S4), `GET /invoices/summary?staffId=me` (S1) |
| 4 | Hồ sơ | `ProfileScreen` | — |

**Bỏ khỏi vai trò gộp:** tab **Tổng quan** (bản sao thứ 3 của dashboard admin) → thay bằng dải KPI 4 số trên đầu Sơ đồ phòng + màn Chốt ca trong tab Hóa đơn. Tab **Trả phòng** của thu ngân cũ gộp vào tab "Hôm nay".

**Mở thêm cho vai trò gộp:** nút "Tạo hóa đơn thủ công" (trước lễ tân bị 403), nút "Hoàn tiền", nút "Đổi phòng" trong ô phòng `OCCUPIED`, nút "Đặt phòng tại quầy" ở tab Duyệt đơn.

#### KHÁCH HÀNG — 4 tab (từ 5)

| # | Tab | Màn hình | Ghi chú |
|:--:|---|---|---|
| 0 | Khám phá | `CustomerHomeScreen` | Ô tìm kiếm trên đầu **push** `RoomSearchScreen` |
| 1 | **Dịch vụ** 🆕 | `ServiceOrderScreen` 🆕 | `GET /services`, `POST /bookings/:id/service-requests` (C1). Khi không lưu trú: hiện danh mục + CTA đặt phòng |
| 2 | **Chuyến đi của tôi** ♻️ | `MyBookingsScreen` — 2 segment: Đơn · Hóa đơn | Gộp `MyInvoicesScreen` vào đây |
| 3 | Tài khoản | `ProfileScreen` | — |

**Bỏ khỏi app khách:** tab **Tìm kiếm** (Khám phá đã có ô tìm kiếm dẫn sang cùng màn) và tab **Hóa đơn của tôi** (hóa đơn luôn gắn với một đơn — đặt cạnh đơn là đúng ngữ cảnh hơn).

### 4.4 Màn hình mới cần tạo (FE)

| File | Vai trò | Nội dung |
|---|---|---|
| `lib/features/admin/screens/reports_screen.dart` | ADMIN | Doanh thu năm (12 tháng) + bảng hiệu suất nhân viên (A1) + nút xuất CSV (A3) + lối vào "Sổ hóa đơn" |
| `lib/features/admin/screens/room_operations_screen.dart` | ADMIN | Vỏ 3 segment bọc màn phòng / hạng phòng / chờ duyệt sẵn có |
| `lib/features/admin/screens/service_catalog_screen.dart` | ADMIN | CRUD danh mục dịch vụ (A2) |
| `lib/features/receptionist/screens/front_desk_today_screen.dart` | LỄ TÂN–THU NGÂN | 2 segment Nhận phòng / Trả phòng, badge số lượng |
| `lib/features/receptionist/screens/shift_close_screen.dart` | LỄ TÂN–THU NGÂN | Chốt ca: tiền thu theo phương thức, số hóa đơn, nút in/chia sẻ (S1) |
| `lib/features/receptionist/widgets/change_room_sheet.dart` | LỄ TÂN–THU NGÂN | Bottom sheet đổi phòng: chọn phòng trống + lý do (S2) |
| `lib/features/cashier/widgets/refund_sheet.dart` | LỄ TÂN–THU NGÂN | Bottom sheet hoàn tiền: số tiền + lý do (S4) |
| `lib/features/customer/screens/service_order_screen.dart` | KHÁCH | Danh mục dịch vụ + giỏ yêu cầu + trạng thái yêu cầu (C1) |
| `lib/shared/widgets/shift_kpi_strip.dart` | LỄ TÂN–THU NGÂN | Dải 4 KPI ca trực gắn đầu Sơ đồ phòng (thay tab Tổng quan) |

Sửa nhưng không tạo mới: `staff_tab_scaffold.dart` (bỏ nhánh dựng tab cho cashier), `my_bookings_screen.dart` (thêm segment Hóa đơn), `customer_tab_scaffold.dart` (5 → 4 tab), `cashier_invoices_screen.dart` (thêm 2 nút), `room_matrix_screen.dart` (thêm KPI strip + chip `PENDING_APPROVAL` + nút Đổi phòng).

### 4.5 Các chỗ còn nhắc tới `cashier` phải dọn

| File | Việc |
|---|---|
| `lib/features/profile/screens/profile_screen.dart:992-1052` | Chuỗi `if role == admin … : receptionist … : cashier` → còn 3 nhánh |
| `lib/features/profile/screens/profile_screen.dart:1248-1251` | Bỏ thẻ chuyển nhanh sang tài khoản thu ngân (hoặc đổi nhãn thành "Lễ tân – Thu ngân (quầy sảnh)" trỏ `cashier@hotel.com` — tài khoản này vẫn đăng nhập được, chỉ khác role) |
| `lib/features/auth/screens/login_screen.dart` | Chip tài khoản demo: gộp 2 chip lễ tân/thu ngân thành 1 |
| `lib/features/admin/screens/user_management_screen.dart` | Dropdown chọn role khi tạo/sửa nhân sự: bỏ mục Thu ngân |
| `lib/features/admin/screens/today_check_outs_screen.dart`, `admin_dashboard_screen.dart`, `my_invoices_screen.dart` | Bỏ nhánh điều kiện theo `UserRole.cashier` |
| `lib/core/network/api_endpoints.dart` | Thêm hằng cho endpoint mới; bỏ hằng chỉ dùng cho nhánh cashier nếu có |
| `lib/shared/repositories/invoice_repository.dart`, `user_repository.dart` | Thêm `refund`, `summaryForStaff`; bỏ tham chiếu role cũ |

### 4.6 Test cần cập nhật

| File test | Thay đổi |
|---|---|
| `test/role_access_test.dart` | Ma trận 4 role → 3; thêm ca kiểm tra redirect `/cashier*` |
| `test/tab_bar_test.dart`, `test/admin_tab_scaffold_test.dart` | Số tab và nhãn mới của cả 3 vai trò |
| `test/account_switch_test.dart` | Bỏ ca chuyển sang thu ngân; thêm ca "phiên cũ cache role CASHIER vẫn vào được app" (kiểm tra alias `fromString`) |
| `test/auth_login_test.dart` | `cashier@hotel.com` đăng nhập ra `UserRole.receptionist` |
| `test/cashier_invoices_test.dart` | Nút "Tạo hóa đơn" giờ **hiện** với vai trò gộp; thêm ca hoàn tiền |
| `test/model_alignment_test.dart` | `UserModel.fromJson({'role': 'CASHIER'})` → `receptionist` |

---

## 5. Thứ tự triển khai

| Giai đoạn | BE | FE | Điều kiện qua |
|---|---|---|---|
| **P0 — Gộp role** | §3.2 → §3.3 → migration §3.1 | §4.1, §4.2, §4.5 | Đăng nhập cả 3 vai trò chạy đúng; `grep CASHIER` sạch ở cả 2 repo (trừ alias `fromString` có chú thích) |
| **P1 — Dọn tab** | không có việc | §4.3, §4.4 (các màn gộp), §4.6 | Không màn hình nào còn là tab của ≥2 vai trò trừ Hồ sơ |
| **P2 — Chức năng mới nhóm P1** | A1, A2, S1, S2, S4, C1 | 9 file mới ở §4.4 | Swagger đủ endpoint; mỗi tab mới có dữ liệu thật |
| **P3 — Nhóm P2** | A3, A4, S3, C2, C3, C4 | màn tương ứng | — |

**Rollback P0:** migration ngược (tạo lại enum có `CASHIER` rồi `UPDATE` các user theo danh sách email đã lưu trước khi chạy). Chụp lại `SELECT id, email, role FROM users WHERE role='CASHIER'` **trước** bước 2 của §3.1 và lưu vào file — đó là toàn bộ dữ liệu cần để hoàn tác.

---

## 6. Nghiệm thu

- [ ] `grep -rn "CASHIER" src prisma --include="*.ts"` → rỗng (BE).
- [ ] `grep -rn "cashier" lib --include="*.dart"` → chỉ còn nhánh alias trong `role_enum.dart` (kèm chú thích) và thư mục `features/cashier/` (đổi tên thư mục là tùy chọn, không bắt buộc).
- [ ] `cashier@hotel.com` / `Staff@123` đăng nhập được, vào đúng `/receptionist`, thấy đủ 5 tab mới.
- [ ] Phiên đang đăng nhập bằng thu ngân **trước** khi cập nhật app: mở app lên không văng, tự vào nhánh lễ tân.
- [ ] Deep link `/cashier/check-outs` mở ra tab "Hôm nay".
- [ ] Vai trò gộp bấm "Tạo hóa đơn thủ công" không còn 403.
- [ ] Không vai trò nào còn 2 tab dẫn tới cùng một widget.
- [ ] `npm run build` (BE) và `flutter test` (FE) đều xanh.
- [ ] `API-CONTRACT.md` và `design/FE-ROLE-MATRIX.md` đã cập nhật theo §3.5.

---

## 7. Rủi ro cần canh

| Rủi ro | Mức | Cách chặn |
|---|:--:|---|
| Phiên FE cũ cache `role: "CASHIER"` → route không tồn tại → app trắng màn | **Cao** | Alias trong `fromString` (§4.1) + redirect (§4.2). Bắt buộc có, không phải tùy chọn. |
| Migration enum fail giữa chừng, cột `role` mất `DEFAULT` | Trung bình | Chạy cả 6 câu SQL trong **một** transaction; đã có `SET DEFAULT` ở câu cuối. |
| Admin mất lối vào hóa đơn sau khi bỏ tab | Trung bình | Route `/admin/invoices` vẫn còn, đặt lối vào rõ ràng trong tab Báo cáo. Ghi vào ghi chú phát hành. |
| Mở `POST /invoices` cho vai trò gộp làm phát sinh hóa đơn trùng | Thấp | `Invoice.bookingId` là `@unique` — BE đã chặn sẵn ở tầng DB. |
| Lễ tân cũ quen tab "Tổng quan" | Thấp | Dải KPI ca trực đặt ngay đầu màn mặc định sau đăng nhập. |
