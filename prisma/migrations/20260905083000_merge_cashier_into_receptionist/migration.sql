-- 1. Chuyển toàn bộ tài khoản thu ngân sang lễ tân (idempotent, chạy lại vẫn an toàn)
UPDATE "users" SET "role" = 'RECEPTIONIST' WHERE "role"::text = 'CASHIER';

-- 2. Dựng lại kiểu enum không còn CASHIER
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RECEPTIONIST', 'CUSTOMER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
DROP TYPE "Role_old";

-- 3. Tạo bảng hotel_services lưu trữ danh mục dịch vụ có thật trong DB (A2 - P1)
CREATE TABLE IF NOT EXISTS "hotel_services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'lần',
    "icon" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hotel_services_code_key" ON "hotel_services"("code");

-- 4. Bổ sung các trường phục vụ khách gọi dịch vụ phòng (C1 - P1)
ALTER TABLE "extra_service_orders" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "extra_service_orders" ADD COLUMN IF NOT EXISTS "requestedById" TEXT;
ALTER TABLE "extra_service_orders" ADD COLUMN IF NOT EXISTS "note" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'extra_service_orders_requestedById_fkey'
  ) THEN
    ALTER TABLE "extra_service_orders" ADD CONSTRAINT "extra_service_orders_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
