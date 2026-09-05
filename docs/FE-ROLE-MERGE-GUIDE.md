# Hướng dẫn Triển khai Frontend (Flutter): Gộp Vai Trò Lễ Tân – Thu Ngân & Cấu Trúc Tab Mới

> **Dự án:** Frontend `hotel_app` (Flutter).  
> **Backend tương ứng:** `Hotel-Management` (NestJS + Prisma) — *đã hoàn thành 100% việc gộp vai trò & triển khai API nhóm P1*.  
> **Mục tiêu:** Cung cấp bản đặc tả kỹ thuật chi tiết, mã mẫu Dart, luồng router, cấu trúc màn hình và checklist nghiệm thu để đội ngũ Frontend triển khai nhanh chóng, chính xác, không phát sinh lỗi phiên đăng nhập cũ.

---

## 1. Tóm tắt Quyết định & Nguyên tắc cốt lõi

| Quyết định | Chi tiết cho Frontend |
|---|---|
| **Số vai trò chính thức** | Thu gọn từ 4 xuống **3 vai trò**: `ADMIN`, `RECEPTIONIST` (nhãn hiển thị: **Lễ tân – Thu ngân**), `CUSTOMER`. |
| **Giá trị Enum Enum** | Giữ nguyên enum value `RECEPTIONIST`. Bỏ hoàn toàn `CASHIER` khỏi các enum lựa chọn, nhưng **bắt buộc giữ alias tương thích ngược** trong bộ parse JSON. |
| **Bảo toàn phiên cũ (Critical)** | Người dùng đang đăng nhập bằng tài khoản thu ngân cũ vẫn có `role: "CASHIER"` lưu trong `FlutterSecureStorage`. Khi parse sang `UserRole`, phải map về `UserRole.receptionist`. |
| **Nguyên tắc tab** | *Một chức năng — một chủ sở hữu tab.* Không màn hình nào là tab của $\ge 2$ vai trò (ngoại trừ **Hồ sơ**). Các vai trò khác truy cập chức năng thông qua đường dẫn phụ (drill-down, button, segment, filter chip). |
| **Số lượng tab mới** | **ADMIN: 5 tab** · **LỄ TÂN – THU NGÂN: 5 tab** · **KHÁCH HÀNG: 4 tab**. |

---

## 2. Thay đổi Core Models & Enums

### 2.1 Cập nhật `lib/core/constants/role_enum.dart`

Xóa hằng `cashier`, đổi nhãn hiển thị của `receptionist` thành `"Lễ tân – Thu ngân"`, và cấu hình alias an toàn trong `fromString`:

```dart
enum UserRole {
  customer('CUSTOMER', 'Khách hàng'),
  receptionist('RECEPTIONIST', 'Lễ tân – Thu ngân'),
  admin('ADMIN', 'Quản trị viên / Giám đốc');

  final String value;
  final String label;

  const UserRole(this.value, this.label);

  static UserRole fromString(String? role) {
    switch (role?.trim().toUpperCase()) {
      case 'ADMIN':
        return UserRole.admin;
      case 'RECEPTIONIST':
      // PHÒNG VỆ: Phiên cũ còn cache role "CASHIER" trong secure storage.
      // Tuyệt đối không xóa nhánh này để tránh lỗi trắng màn hình / crash app.
      case 'CASHIER':
        return UserRole.receptionist;
      case 'CUSTOMER':
      default:
        return UserRole.customer;
    }
  }

  String toJson() => value;
}
```

### 2.2 Cập nhật `lib/core/constants/role_permissions.dart`

Xóa bỏ biến nội bộ `_isCashier`. Gộp các quyền trước đây của Thu ngân và Lễ tân vào quyền chung của Nhân viên (`isStaff`):

```dart
extension RolePermissions on UserRole {
  bool get _isAdmin => this == UserRole.admin;
  bool get _isReceptionist => this == UserRole.receptionist;
  bool get isStaff => _isAdmin || _isReceptionist;
  bool get isCustomer => this == UserRole.customer;

  // --- 1. Quyền hiện có (Đã cập nhật sau gộp) ---
  bool get canCreateInvoice => isStaff;          // Trước: Admin || Cashier -> Nay: mở cho Lễ tân-Thu ngân
  bool get canCheckIn => isStaff;                // Nhân viên lễ tân quầy
  bool get canCheckOut => isStaff;               // Check-out & xuất hóa đơn
  bool get canAddBookingServices => isStaff;      // Ghi nhận dịch vụ phát sinh
  bool get canChangeRoomStatus => isStaff;       // Đổi trạng thái buồng phòng
  bool get canViewOccupancy => isStaff;          // Xem tỷ lệ lấp đầy phòng

  // --- 2. Quyền cho các tính năng mới P1 ---
  bool get canRefundInvoice => isStaff;          // S4: Hoàn tiền hóa đơn
  bool get canChangeRoom => isStaff;             // S2: Đổi phòng cho khách đang lưu trú
  bool get canCloseShift => isStaff;             // S1: Xem sổ quỹ cá nhân / chốt ca trực
  bool get canManageServiceCatalog => _isAdmin;  // A2: Quản trị danh mục dịch vụ (Chỉ Admin)
  bool get canViewStaffPerformance => _isAdmin;  // A1: Xem báo cáo hiệu suất nhân sự (Chỉ Admin)
  bool get canRequestService => isCustomer;      // C1: Khách hàng gọi dịch vụ tại phòng

  // Đường dẫn mặc định khi đăng nhập
  String get homeRoute {
    switch (this) {
      case UserRole.admin:
        return '/admin';
      case UserRole.receptionist:
        return '/receptionist';
      case UserRole.customer:
        return '/customer';
    }
  }
}
```

---

## 3. Cấu trúc Router & Xử lý Redirect (`app_router.dart`)

### 3.1 Redirect các đường dẫn cũ của Thu ngân
Trước khi router kiểm tra quyền truy cập (`_canAccess`), thêm cơ chế chuyển hướng các deep link và bookmark cũ của cashier:

```dart
const Map<String, String> _legacyCashierRedirects = {
  '/cashier': '/receptionist/invoices',
  '/cashier/dashboard': '/receptionist',         // Tổng quan cũ chuyển về Sơ đồ phòng
  '/cashier/check-outs': '/receptionist/today',  // Chuyển về tab Hôm nay (segment Trả phòng)
  '/cashier/invoices': '/receptionist/invoices', // Sổ hóa đơn
  '/cashier/profile': '/receptionist/profile',
};

// Trong logic redirect của GoRouter:
final location = state.matchedLocation;
if (_legacyCashierRedirects.containsKey(location)) {
  return _legacyCashierRedirects[location];
}
```

### 3.2 Xóa shell `/cashier` và định nghĩa 3 Shell Route mới

```dart
// Role sets dùng trong Route Guards:
const Set<UserRole> _staffRoles = {UserRole.admin, UserRole.receptionist};
```

---

## 4. Ma trận Tab mới sau khi Dọn Trùng

### 4.1 Bộ 5 Tab của ADMIN

| Tab | Tên Tab | Icon | Màn hình | Nguồn API | Mô tả chức năng |
|:--:|---|:--:|---|---|---|
| **0** | **Tổng quan** | `dashboard_outlined` | `AdminDashboardScreen` | `GET /analytics/dashboard`<br>`GET /analytics/occupancy-by-type` | KPI phòng hôm nay, doanh thu hôm nay, tỷ lệ lấp đầy, biểu đồ mini. |
| **1** | **Báo cáo** 🆕 | `bar_chart_outlined` | `ReportsScreen` 🆕 | `GET /analytics/revenue?year=`<br>`GET /analytics/staff-performance` (A1)<br>`GET /analytics/revenue/export` (A3) | Biểu đồ doanh thu 12 tháng, bảng xếp hạng hiệu suất nhân viên (A1), nút xuất báo cáo CSV, nút dẫn sang xem Sổ hóa đơn read-only (`/admin/invoices`). |
| **2** | **Vận hành phòng** ♻️ | `meeting_room_outlined` | `RoomOperationsScreen` 🆕 | `GET /rooms`, `GET /room-types`<br>`PATCH /rooms/:id/approve` | Màn hình chứa 3 Tab/Segment:<br>1. **Sơ đồ phòng** (read-only)<br>2. **Hạng phòng** (quản trị CRUD)<br>3. **Chờ duyệt** (duyệt phòng mới tạo). |
| **3** | **Nhân sự & Dịch vụ** ♻️ | `people_outline` | `StaffAndServicesScreen` 🆕 | `GET /users`<br>`GET /services` (A2) | Gồm 2 Tab/Segment:<br>1. **Nhân viên** (`UserManagementScreen`)<br>2. **Bảng giá dịch vụ** (`ServiceCatalogScreen` 🆕). |
| **4** | **Hồ sơ** | `person_outline` | `ProfileScreen` | `GET /auth/me` | Thông tin cá nhân, cài đặt tài khoản, đăng xuất. |

*Lưu ý cho Admin:* Tab Thu ngân/Hóa đơn cũ được gỡ bỏ vì trùng với Lễ tân. Admin truy cập Sổ hóa đơn thông qua nút "Xem sổ hóa đơn" trong tab **Báo cáo** (`context.push('/admin/invoices')`).

---

### 4.2 Bộ 5 Tab của LỄ TÂN – THU NGÂN (`UserRole.receptionist`)

| Tab | Tên Tab | Icon | Màn hình | Nguồn API | Mô tả chức năng |
|:--:|---|:--:|---|---|---|
| **0** | **Sơ đồ phòng** | `grid_view_outlined` | `RoomMatrixScreen` + `ShiftKpiStrip` 🆕 | `GET /rooms`<br>`PATCH /rooms/:id/status`<br>`GET /analytics/dashboard` | **Đầu màn hình:** Dải 4 chip KPI ca trực (Trống, Đang ở, Chờ dọn, Khách sắp đến).<br>**Thân màn hình:** Ma trận phòng, bấm vào phòng `OCCUPIED` có thêm nút **"Đổi phòng" (S2)**. |
| **1** | **Hôm nay** ♻️ | `today_outlined` | `FrontDeskTodayScreen` 🆕 | `GET /bookings?checkInFrom=...`<br>`POST /bookings/:id/check-in`<br>`POST /bookings/:id/check-out` | Gộp 2 segment:<br>- **Khách đến (Check-in)** kèm badge số lượng.<br>- **Khách đi (Check-out)** kèm nút thanh toán & trả phòng. |
| **2** | **Duyệt đơn** | `fact_check_outlined` | `BookingApprovalScreen` | `PATCH /bookings/:id/confirm`<br>`PATCH /bookings/:id/reject`<br>`POST /bookings` (Walk-in S5) | Duyệt đơn khách đặt trước qua app; nút nổi (FAB) **"Đặt phòng tại quầy (Walk-in)"** tạo đơn và check-in ngay lập tức. |
| **3** | **Hóa đơn & Thu quỹ** ♻️ | `receipt_long_outlined` | `CashierInvoicesScreen` + nút Chốt ca | `GET /invoices`<br>`POST /invoices` (Tạo thủ công)<br>`POST /invoices/:id/refund` (S4)<br>`GET /invoices/summary?staffId=me` (S1) | Quản lý hóa đơn; nút **"Tạo hóa đơn thủ công"** (trước đây lễ tân bị 403, nay đã mở); nút **"Hoàn tiền" (S4)**; nút icon trên thanh AppBar **"Chốt ca trực" (S1)**. |
| **4** | **Hồ sơ** | `person_outline` | `ProfileScreen` | `GET /auth/me` | Thông tin tài khoản, ca trực, đổi mật khẩu, đăng xuất. |

*Lưu ý cho Lễ tân:* Đã bỏ tab "Tổng quan" (vì bản chất là dashboard của admin). 4 chỉ số KPI quan trọng nhất trong ca trực được đưa trực tiếp lên đầu tab **Sơ đồ phòng** qua widget `ShiftKpiStrip`.

---

### 4.3 Bộ 4 Tab của KHÁCH HÀNG (`UserRole.customer`)

| Tab | Tên Tab | Icon | Màn hình | Nguồn API | Mô tả chức năng |
|:--:|---|:--:|---|---|---|
| **0** | **Khám phá** | `explore_outlined` | `CustomerHomeScreen` | `GET /room-types`<br>`GET /rooms/search` | Khám phá khách sạn, banner ưu đãi. Thanh tìm kiếm trên đỉnh bấm vào sẽ **push** sang `RoomSearchScreen` (không chiếm 1 tab riêng). |
| **1** | **Dịch vụ** 🆕 | `room_service_outlined` | `ServiceOrderScreen` 🆕 | `GET /services`<br>`POST /bookings/:id/service-requests` (C1) | Xem danh mục dịch vụ phòng (Ăn uống, Spa, Giặt là, Xe đưa đón). Nếu đang lưu trú: cho phép chọn dịch vụ và bấm **"Gọi lên phòng"** (C1). |
| **2** | **Chuyến đi của tôi** ♻️ | `luggage_outlined` | `MyBookingsScreen` | `GET /bookings/my`<br>`GET /invoices/my` | Gồm 2 segment:<br>- **Đơn đặt phòng** (Đang ở, Sắp tới, Lịch sử).<br>- **Hóa đơn của tôi** (Gộp từ màn `MyInvoicesScreen` vào đây). |
| **3** | **Tài khoản** | `person_outline` | `ProfileScreen` | `GET /auth/me` | Quản lý thông tin cá nhân, tích điểm hội viên, trợ giúp. |

---

## 5. Đặc tả Kỹ thuật Các Màn hình & Widget Mới (P1)

### 5.1 Dải KPI ca trực: `ShiftKpiStrip` (`lib/shared/widgets/shift_kpi_strip.dart`)
- **Vị trí:** Gắn ngay trên đầu `RoomMatrixScreen` của Lễ tân – Thu ngân.
- **Nguồn dữ liệu:** Lấy từ `GET /api/v1/analytics/dashboard`.
- **Giao diện:** Card bo góc nằm ngang gồm 4 khối số liệu:
  1. 🟢 **Phòng trống:** `availableRooms`
  2. 🔵 **Đang ở:** `occupiedRooms`
  3. 🟡 **Chờ dọn:** `cleaningRooms`
  4. 🟣 **Khách đến hôm nay:** `todayCheckIns`

```dart
class ShiftKpiStrip extends StatelessWidget {
  final int available;
  final int occupied;
  final int cleaning;
  final int checkIns;

  const ShiftKpiStrip({
    super.key,
    required this.available,
    required this.occupied,
    required this.cleaning,
    required this.checkIns,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.4),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildItem(context, 'Trống', available, Colors.teal),
          _buildItem(context, 'Đang ở', occupied, Colors.blue),
          _buildItem(context, 'Chờ dọn', cleaning, Colors.orange),
          _buildItem(context, 'Khách đến', checkIns, Colors.purple),
        ],
      ),
    );
  }

  Widget _buildItem(BuildContext context, String label, int value, Color color) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$value', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
```

---

### 5.2 Chốt ca trực: `ShiftCloseScreen` (`lib/features/receptionist/screens/shift_close_screen.dart`)
- **Vị trí:** Mở từ nút biểu tượng "Chốt ca" trên AppBar tab Hóa đơn.
- **API gọi:** `GET /api/v1/invoices/summary?date=today&staffId=me`.
- **Dữ liệu hiển thị:**
  - Tên nhân viên: `staffName`
  - Ngày chốt: `date`
  - Tổng số tiền thu được trong ca: `amountCollected` (định dạng VND)
  - Phân rã theo phương thức thanh toán:
    - 💵 Tiền mặt (`CASH`): `byMethod.CASH`
    - 💳 Thẻ POS (`CREDIT_CARD`): `byMethod.CREDIT_CARD`
    - 🏦 Chuyển khoản QR (`BANK_TRANSFER`): `byMethod.BANK_TRANSFER`
  - Số lượng hóa đơn đã xuất: `invoicesIssued`
  - Số lượng hóa đơn chưa thu còn tồn: `unpaidLeftBehind`
- **Hành động:** Nút "In biên bản chốt ca" (xuất file hoặc chia sẻ hình ảnh).

---

### 5.3 Bottom Sheet Đổi phòng: `ChangeRoomSheet` (`lib/features/receptionist/widgets/change_room_sheet.dart`)
- **Vị trí:** Bấm vào một phòng đang có khách (`OCCUPIED`) trên `RoomMatrixScreen` $\rightarrow$ Chọn action "Đổi phòng cho khách".
- **API gọi:** `POST /api/v1/bookings/:id/change-room`.
- **Form đầu vào:**
  1. `newRoomId`: Dropdown chọn phòng mới (chỉ lọc danh sách các phòng đang `AVAILABLE` từ store).
  2. `reason`: Lý do đổi phòng (bắt buộc nhập, ví dụ: "Điều hòa phòng 301 có tiếng ồn lớn").
  3. `keepPrice`: Switch bật/tắt "Giữ nguyên đơn giá phòng cũ" (Mặc định: `true`). Nếu tắt, hệ thống sẽ tự động tính lại tiền phòng cho những ngày còn lại theo giá hạng phòng mới.
- **Xử lý thành công:** Đóng sheet, hiển thị SnackBar `"Đã chuyển khách sang phòng ... thành công"`, tự động reload ma trận phòng.

---

### 5.4 Bottom Sheet Hoàn tiền: `RefundSheet` (`lib/features/cashier/widgets/refund_sheet.dart`)
- **Vị trí:** Trong màn hình chi tiết hóa đơn (`InvoiceDetailScreen`), nếu `paidAmount > 0` $\rightarrow$ Hiển thị nút "Hoàn tiền".
- **API gọi:** `POST /api/v1/invoices/:id/refund`.
- **Form đầu vào:**
  1. `amount`: Số tiền muốn hoàn (Validate: $> 0$ và $\le$ số tiền đã thu `paidAmount`).
  2. `reason`: Lý do hoàn tiền (bắt buộc, ví dụ: "Khách trả phòng sớm 1 đêm").
- **Xử lý thành công:** Đóng sheet, cập nhật lại trạng thái hóa đơn (`REFUNDED` hoặc `PARTIAL`), làm mới danh sách hóa đơn.

---

### 5.5 Khách gọi dịch vụ phòng: `ServiceOrderScreen` (`lib/features/customer/screens/service_order_screen.dart`)
- **Vị trí:** Tab thứ 2 của khách hàng.
- **API gọi:**
  - Lấy danh mục dịch vụ: `GET /api/v1/services`
  - Gửi yêu cầu: `POST /api/v1/bookings/:id/service-requests`
- **Luồng nghiệp vụ:**
  - Kiểm tra xem khách có đơn nào đang ở trạng thái `CHECKED_IN` không:
    - Nếu **KHÔNG**: Hiển thị danh mục dịch vụ khách sạn ở chế độ tham khảo + Nút CTA "Đặt phòng ngay để trải nghiệm dịch vụ".
    - Nếu **CÓ**: Cho phép chọn số lượng từng món (Giặt là, Nước ngọt minibar, Đặt ăn tại phòng) $\rightarrow$ Bấm nút "Gọi lên phòng ...".
- **Xử lý phía Lễ tân:**
  - Trên màn hình chi tiết đơn đặt phòng của Lễ tân, danh sách dịch vụ phát sinh hiển thị trạng thái `REQUESTED` kèm 2 nút:
    - 🟢 **Duyệt (`CONFIRMED`):** Gọi `PATCH /api/v1/bookings/:id/services/:orderId` với `status: 'CONFIRMED'`. Khi duyệt, tiền dịch vụ sẽ được tính vào hóa đơn lúc trả phòng.
    - 🔴 **Từ chối (`REJECTED`):** Nhập lý do từ chối (ví dụ: "Đã hết món").

---

### 5.6 Màn hình Báo cáo Quản trị: `ReportsScreen` (`lib/features/admin/screens/reports_screen.dart`)
- **Vị trí:** Tab thứ 2 của Quản trị viên.
- **API gọi:**
  - `GET /api/v1/analytics/revenue?year=2026`: Biểu đồ doanh thu 12 tháng.
  - `GET /api/v1/analytics/staff-performance?from=...&to=...`: Bảng hiệu suất làm việc của nhân viên lễ tân – thu ngân:
    - Cột: Tên nhân sự | Đơn đã duyệt | Đơn hủy | Số HĐ xuất | Tiền thực thu.
- **Lối vào Sổ hóa đơn:** Một card/banner ghim trên màn hình: *"Sổ nhật ký hóa đơn toàn khách sạn $\rightarrow$ Bấm để xem"* dẫn tới `/admin/invoices` (màn hình `CashierInvoicesScreen` nhưng ở chế độ xem).

---

## 6. Danh sách Endpoint Mới cho FE Integration

Tất cả các endpoint dưới đây đã được hoàn thành và kiểm thử trên Backend:

```dart
class ApiEndpoints {
  // --- Analytics & Staff Performance ---
  static const String staffPerformance = '/api/v1/analytics/staff-performance'; // GET (?from=&to=)
  
  // --- Hotel Services Catalog ---
  static const String hotelServices = '/api/v1/services'; // GET (Public), POST, PATCH /:id, DELETE /:id
  
  // --- Invoices & Shifts ---
  static const String invoiceSummary = '/api/v1/invoices/summary'; // GET (?date=today&staffId=me)
  static String invoiceRefund(String id) => '/api/v1/invoices/$id/refund'; // POST
  
  // --- Bookings Operations ---
  static String changeRoom(String bookingId) => '/api/v1/bookings/$bookingId/change-room'; // POST
  static String serviceRequests(String bookingId) => '/api/v1/bookings/$bookingId/service-requests'; // POST
  static String updateServiceRequest(String bookingId, String orderId) => 
      '/api/v1/bookings/$bookingId/services/$orderId'; // PATCH
}
```

---

## 7. Checklist Rà soát Mã nguồn FE (Dọn dẹp triệt để `cashier`)

Hãy kiểm tra và thực hiện lần lượt các vị trí sau trong codebase `hotel_app`:

- [ ] **`lib/core/constants/role_enum.dart`**:
  - Bỏ hằng `cashier`.
  - Giữ alias `'CASHIER' -> UserRole.receptionist` trong `UserRole.fromString`.
  - Đổi label thành `"Lễ tân – Thu ngân"`.
- [ ] **`lib/core/constants/role_permissions.dart`**:
  - Đổi các getter: `canCreateInvoice`, `canCheckIn`, `canAddBookingServices`, `canChangeRoomStatus`, `canViewOccupancy` sang `isStaff`.
  - Thêm các getter mới: `canRefundInvoice`, `canChangeRoom`, `canCloseShift`, `canManageServiceCatalog`, `canViewStaffPerformance`.
- [ ] **`lib/core/router/app_router.dart`**:
  - Bỏ nhánh `StatefulShellRoute` của `/cashier`.
  - Thêm map redirect `_legacyCashierRedirects`.
  - Sửa danh sách tab của 3 vai trò theo đúng Mục 4.
- [ ] **`lib/features/profile/screens/profile_screen.dart`**:
  - Bỏ các nhánh kiểm tra điều kiện `if (role == UserRole.cashier)`.
  - Xóa thẻ chuyển tài khoản nhanh sang Thu ngân (hoặc đổi tài khoản `cashier@hotel.com` thành nhãn *"Lễ tân – Thu ngân (Quầy sảnh)"*).
- [ ] **`lib/features/auth/screens/login_screen.dart`**:
  - Gộp các chip đăng nhập nhanh demo: Chỉ còn 3 nhóm tài khoản (Admin, Lễ tân – Thu ngân, Khách hàng).
- [ ] **`lib/features/admin/screens/user_management_screen.dart`**:
  - Trong Dropdown tạo/sửa nhân viên: Xóa lựa chọn `CASHIER`, chỉ còn `ADMIN`, `RECEPTIONIST`, `CUSTOMER`.
- [ ] **`lib/features/cashier/screens/cashier_invoices_screen.dart`**:
  - Đổi tiêu đề màn hình thành *"Hóa đơn & Thu quỹ"*.
  - Bật hiển thị nút "Tạo hóa đơn thủ công" cho `UserRole.receptionist`.
  - Bổ sung nút icon mở màn hình Chốt ca trực `ShiftCloseScreen`.
- [ ] **`lib/shared/repositories/invoice_repository.dart`**:
  - Bổ sung hàm `refund(String invoiceId, double amount, String reason)`.
  - Bổ sung hàm `getShiftSummary({String? date, String staffId = 'me'})`.

---

## 8. Kế hoạch Cập nhật Kiểm thử (Test Cases)

| File Test | Thay đổi bắt buộc |
|---|---|
| `test/role_access_test.dart` | Ma trận quyền từ 4 role $\rightarrow$ 3 role. Thêm ca test redirect `/cashier/check-outs` $\rightarrow$ `/receptionist/today`. |
| `test/tab_bar_test.dart` | Kiểm tra số lượng tab: Admin = 5, Receptionist = 5, Customer = 4. |
| `test/account_switch_test.dart` | Thêm ca kiểm thử hồi quy: Giả lập Secure Storage có `role: 'CASHIER'` $\rightarrow$ Khi mở app phải khởi tạo thành công dưới quyền `UserRole.receptionist`. |
| `test/auth_login_test.dart` | Đăng nhập tài khoản `cashier@hotel.com` / `Staff@123` phải trả về `UserRole.receptionist`. |
| `test/cashier_invoices_test.dart` | Nút "Tạo hóa đơn" hiện diện và hoạt động với tài khoản `RECEPTIONIST`. |

---

## 9. Tiêu chí Nghiệm thu Hoàn thành (Definition of Done)

1. ✅ `grep -rn "UserRole.cashier" lib test` chỉ còn **0 kết quả** (trừ alias phòng vệ trong `role_enum.dart`).
2. ✅ Chạy `flutter test` toàn bộ suite kiểm thử màu xanh (pass 100%).
3. ✅ Đăng nhập tài khoản `cashier@hotel.com`:
   - Hiển thị đúng nhãn chức vụ: **Lễ tân – Thu ngân**.
   - Hiển thị đúng thanh điều hướng 5 tab mới (Sơ đồ phòng, Hôm nay, Duyệt đơn, Hóa đơn & Thu quỹ, Hồ sơ).
   - Bấm "Tạo hóa đơn thủ công" thành công, không gặp lỗi 403 Forbidden.
4. ✅ Giả lập phiên cũ (ghi đè storage `'CASHIER'`): Mở app không bị văng màn hình trắng, tự điều hướng vào nhánh `/receptionist`.
5. ✅ Khách hàng đang lưu trú (`CHECKED_IN`) có thể vào tab **Dịch vụ** để gửi yêu cầu; Lễ tân có thể duyệt hoặc từ chối trực tiếp trên quầy.
