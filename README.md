# Hotel Management System Backend (Hệ thống Quản lý Khách sạn) - PA1 Chuyên Sâu

Dự án Backend Quản lý Khách sạn được xây dựng theo chuẩn kiến trúc doanh nghiệp bằng **NestJS, TypeScript, Prisma ORM, PostgreSQL, Redis 7 (Caching & Distributed Lock), Elasticsearch 8 (Full-Text Search) và Swagger OpenAPI**.

---

## 🌟 Tính năng Chuyên Sâu (PA1 Highlights)

1. **Redis Distributed Lock (Chống Double-Booking Tuyệt Đối)**:
   - Thuật toán khóa phân tán nguyên tử (`SET NX PX`) trên mã phòng và ngày lưu trú.
   - Giải phóng khóa bằng Lua Script an toàn, chống tình trạng race condition khi hàng ngàn khách cùng đặt phòng đồng thời.

2. **Redis Caching**:
   - Cache danh sách phòng trống (`GET /api/v1/rooms/available`) với TTL 60s.
   - Cơ chế tự động xóa cache (Cache Invalidation) tức thì khi có thay đổi trạng thái buồng phòng.

3. **Elasticsearch Full-Text Search**:
   - Chỉ mục tìm kiếm `hotel_rooms` hỗ trợ Fuzzy search (cho phép gõ sai lỗi chính tả nhẹ).
   - Multi-field boosting: Nhân trọng số tìm kiếm theo tên hạng phòng (`^3`), mô tả (`^2`).
   - Lọc kết hợp theo khoảng giá (`minPrice`, `maxPrice`) và tiện ích (`amenities`).
   - Endpoint: `GET /api/v1/rooms/search`.

4. **Xác thực & Phân quyền (Auth & RBAC) & Quên Mật Khẩu**:
   - Đăng ký, Đăng nhập, trích xuất Profile JWT.
   - **Quên mật khẩu & Đặt lại mật khẩu**:
     - `POST /api/v1/auth/forgot-password`: Nhập email, hệ thống sinh mã OTP 6 chữ số ngẫu nhiên an toàn, gửi email thông báo (hoặc log dev) kèm hạn dùng 15 phút.
     - `POST /api/v1/auth/verify-reset-otp`: Xác thực mã OTP và nhận `resetToken`.
     - `POST /api/v1/auth/reset-password`: Đặt mật khẩu mới bằng `resetToken` hoặc cặp `email + otp`, băm bảo mật bằng bcrypt, cơ chế chống replay attack.
   - Phân quyền 4 vai trò: `ADMIN`, `RECEPTIONIST`, `CASHIER`, `CUSTOMER`.

5. **Quy trình Lưu trú & Hóa đơn**:
   - Check-in, Check-out tự động xuất hóa đơn.
   - Ghi nhận minibar và dịch vụ phụ trợ vào hóa đơn.

6. **Dashboard & Analytics**:
   - Thống kê tỷ lệ lấp đầy phòng (Occupancy rate), khách đến/đi trong ngày và doanh thu 12 tháng.

---

## 📁 Cấu trúc Thư mục

```text
hotel-management-be/
├── docs/
│   └── microservices-architecture.md  # Tài liệu thiết kế Microservices & Saga Pattern
├── prisma/
│   ├── schema.prisma                  # Schema PostgreSQL Prisma
│   └── seed.ts                        # Dữ liệu mẫu (Users, Rooms, Bookings)
├── src/
│   ├── analytics/                     # Dashboard & KPIs
│   ├── auth/                          # JWT Auth & Passport
│   ├── bookings/                      # Đặt phòng & Redis Distributed Lock
│   ├── common/                        # Decorators, Guards, Interceptors, Filters
│   ├── elasticsearch/                 # Elasticsearch client & search service
│   ├── invoices/                      # Hóa đơn & thanh toán
│   ├── prisma/                        # PrismaService kết nối PostgreSQL
│   ├── redis/                         # RedisService (Cache & Lock)
│   ├── room-types/                    # Quản lý hạng phòng & đơn giá
│   ├── rooms/                         # Quản lý phòng & API tìm kiếm
│   ├── users/                         # Quản lý người dùng & nhân sự
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml                 # PostgreSQL 16, pgAdmin, Redis 7, Elasticsearch 8
├── package.json
└── tsconfig.json
```

---

## 🚀 Khởi Chạy Hệ Thống

### 1. Khởi động toàn bộ hạ tầng (PostgreSQL, Redis, Elasticsearch, pgAdmin)
```bash
docker compose up -d
```

### 2. Đồng bộ Database & Gieo dữ liệu mẫu
```bash
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
```

### 3. Chạy Server ở chế độ Development
```bash
npm run start:dev
```

- **Swagger Docs**: `http://localhost:3000/api/docs`
- **Elasticsearch Search API**: `http://localhost:3000/api/v1/rooms/search?q=biển`
- **pgAdmin UI**: `http://localhost:5050`
