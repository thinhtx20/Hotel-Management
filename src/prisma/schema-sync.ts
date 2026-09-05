import { Logger } from '@nestjs/common';

/**
 * ĐỒNG BỘ CẤU TRÚC BẢNG LÚC KHỞI ĐỘNG (chống lệch schema giữa Prisma và DB thật)
 *
 * Vì sao cần file này?
 * - Lệnh khởi động production chạy `prisma db push`, nhưng lệnh này DỪNG LẠI khi
 *   phát hiện thao tác gây mất dữ liệu (ví dụ bỏ giá trị CASHIER khỏi enum Role
 *   trong khi bảng users vẫn còn bản ghi CASHIER). Lỗi đó bị `|| echo` nuốt mất,
 *   ứng dụng vẫn chạy nhưng DB thiếu cột mới -> Prisma ném P2022
 *   ("The column ... does not exist in the current database").
 * - Hậu quả thực tế: GET /invoices và GET /bookings đều include serviceOrders,
 *   mà bảng extra_service_orders trên DB cũ chưa có cột status / requestedById /
 *   note, nên FE nhận "Lỗi thao tác cơ sở dữ liệu (P2022)" khi tải hóa đơn.
 *
 * Toàn bộ câu lệnh dưới đây đều idempotent (chạy lại nhiều lần vẫn an toàn) và
 * chỉ THÊM cột / bảng, không bao giờ xóa dữ liệu.
 */

interface SchemaSyncStep {
  label: string;
  sql: string;
}

const SCHEMA_SYNC_STEPS: SchemaSyncStep[] = [
  {
    // Gộp thu ngân vào lễ tân: đổi dữ liệu trước rồi mới dựng lại enum,
    // đây chính là bước khiến `prisma db push` thất bại nếu chưa xử lý.
    label: 'Enum Role bỏ giá trị CASHIER',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'Role' AND e.enumlabel = 'CASHIER'
        ) THEN
          UPDATE "users" SET "role" = 'RECEPTIONIST' WHERE "role"::text = 'CASHIER';
          ALTER TYPE "Role" RENAME TO "Role_old";
          CREATE TYPE "Role" AS ENUM ('ADMIN', 'RECEPTIONIST', 'CUSTOMER');
          ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
          ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
          ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
          DROP TYPE "Role_old";
        END IF;
      END $$;
    `,
  },
  {
    label: 'Enum RoomStatus bổ sung PENDING_APPROVAL',
    sql: `ALTER TYPE "RoomStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';`,
  },
  {
    label: 'Enum RoomStatus bổ sung REJECTED',
    sql: `ALTER TYPE "RoomStatus" ADD VALUE IF NOT EXISTS 'REJECTED';`,
  },
  {
    label: 'Bảng bookings bổ sung dấu vết duyệt / hủy đơn',
    sql: `
      DO $$
      BEGIN
        IF to_regclass('public.bookings') IS NOT NULL THEN
          ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
          ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "confirmedById" TEXT;
          ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "confirmationNote" TEXT;
          ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
          ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
          ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_confirmedById_fkey') THEN
            ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmedById_fkey"
              FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_cancelledById_fkey') THEN
            ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelledById_fkey"
              FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END IF;
      END $$;
    `,
  },
  {
    // Đây là nguyên nhân trực tiếp của lỗi "Tải danh sách hóa đơn thất bại (P2022)"
    label: 'Bảng extra_service_orders bổ sung status / requestedById / note',
    sql: `
      DO $$
      BEGIN
        IF to_regclass('public.extra_service_orders') IS NOT NULL THEN
          ALTER TABLE "extra_service_orders" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'CONFIRMED';
          ALTER TABLE "extra_service_orders" ADD COLUMN IF NOT EXISTS "requestedById" TEXT;
          ALTER TABLE "extra_service_orders" ADD COLUMN IF NOT EXISTS "note" TEXT;

          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'extra_service_orders_requestedById_fkey'
          ) THEN
            ALTER TABLE "extra_service_orders" ADD CONSTRAINT "extra_service_orders_requestedById_fkey"
              FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END IF;
      END $$;
    `,
  },
  {
    // Phục vụ ràng buộc "mỗi tài khoản khách hàng chỉ đăng nhập 1 thiết bị":
    // mã phiên hiện hành được lưu ngay trong CSDL nên vẫn chốt được phiên kể cả khi Redis chưa bật.
    label: 'Bảng users bổ sung phiên đăng nhập 1 thiết bị',
    sql: `
      DO $$
      BEGIN
        IF to_regclass('public.users') IS NOT NULL THEN
          ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeSessionId" TEXT;
          ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeDevice" TEXT;
          ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
        END IF;
      END $$;
    `,
  },
  {
    label: 'Bảng hotel_services (danh mục dịch vụ khách sạn)',
    sql: `
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
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "hotel_services_pkey" PRIMARY KEY ("id")
      );
    `,
  },
  {
    label: 'Chỉ mục duy nhất hotel_services.code',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "hotel_services_code_key" ON "hotel_services"("code");`,
  },
  {
    // gen_random_uuid() có sẵn từ PostgreSQL 13; bản cũ hơn cần pgcrypto.
    // Bước này được phép thất bại (thiếu quyền trên hosting) mà không ảnh hưởng gì.
    label: 'Extension pgcrypto (sinh UUID khi dựng lại sổ thu tiền)',
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
  },
  {
    label: 'Enum PaymentEntryType / PaymentEntryStatus (sổ thu tiền)',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentEntryType') THEN
          CREATE TYPE "PaymentEntryType" AS ENUM ('PAYMENT', 'DEPOSIT', 'REFUND');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentEntryStatus') THEN
          CREATE TYPE "PaymentEntryStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
        END IF;
      END $$;
    `,
  },
  {
    // Dành cho DB đã tạo enum từ bản trước (chỉ có PAYMENT/REFUND).
    label: 'Enum PaymentEntryType bổ sung DEPOSIT',
    sql: `ALTER TYPE "PaymentEntryType" ADD VALUE IF NOT EXISTS 'DEPOSIT';`,
  },
  {
    label: 'Bảng payments (sổ thu tiền chi tiết của hóa đơn)',
    sql: `
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" TEXT NOT NULL,
        "invoiceId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
        "type" "PaymentEntryType" NOT NULL DEFAULT 'PAYMENT',
        "status" "PaymentEntryStatus" NOT NULL DEFAULT 'CONFIRMED',
        "reference" TEXT,
        "note" TEXT,
        "createdById" TEXT,
        "confirmedById" TEXT,
        "confirmedAt" TIMESTAMP(3),
        "rejectedReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
      );
    `,
  },
  {
    label: 'Khóa ngoại và chỉ mục bảng payments',
    sql: `
      DO $$
      BEGIN
        IF to_regclass('public.payments') IS NOT NULL THEN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_invoiceId_fkey') THEN
            ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey"
              FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_createdById_fkey') THEN
            ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey"
              FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_confirmedById_fkey') THEN
            ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmedById_fkey"
              FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;

          CREATE INDEX IF NOT EXISTS "payments_invoiceId_idx" ON "payments"("invoiceId");
          CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");
          CREATE INDEX IF NOT EXISTS "payments_confirmedAt_idx" ON "payments"("confirmedAt");
        END IF;
      END $$;
    `,
  },
];

/**
 * Dựng lại sổ thu tiền cho dữ liệu có sẵn.
 *
 * Trước khi có bảng `payments`, toàn bộ tiền đã thu chỉ nằm ở cột tổng
 * `invoices.paidAmount`. Từ nay `paidAmount` được tính lại từ các dòng CONFIRMED
 * của `payments`, nên mọi hóa đơn cũ (và cả hóa đơn vừa được seed) phải được
 * quy đổi thành một dòng thu tương ứng — nếu không, số tiền khách đã trả sẽ bị
 * về 0 ngay lần tính lại đầu tiên.
 *
 * Câu lệnh chỉ chèn cho hóa đơn CHƯA có dòng thu nào nên chạy lại bao nhiêu lần
 * cũng an toàn.
 */
const BACKFILL_PAYMENT_LEDGER_SQL = `
  INSERT INTO "payments" (
    "id", "invoiceId", "amount", "method", "type", "status",
    "note", "createdById", "confirmedById", "confirmedAt", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid()::text,
    i."id",
    i."paidAmount",
    i."paymentMethod",
    'PAYMENT'::"PaymentEntryType",
    'CONFIRMED'::"PaymentEntryStatus",
    'Khoản thu chuyển từ dữ liệu cũ (trước khi có sổ thu tiền chi tiết)',
    i."issuedById",
    i."issuedById",
    COALESCE(i."paidAt", i."updatedAt", i."createdAt"),
    COALESCE(i."paidAt", i."createdAt"),
    CURRENT_TIMESTAMP
  FROM "invoices" i
  WHERE i."paidAmount" > 0
    AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."invoiceId" = i."id");
`;

export async function backfillInvoicePaymentLedger(
  executeRaw: (sql: string) => Promise<unknown>,
  logger: Logger,
): Promise<void> {
  try {
    await executeRaw(BACKFILL_PAYMENT_LEDGER_SQL);
    logger.log('🧾 Sổ thu tiền đã khớp với số tiền đã thu của các hóa đơn cũ.');
  } catch (err: any) {
    logger.warn(`⚠️ Không dựng lại được sổ thu tiền cho hóa đơn cũ: ${err.message}`);
  }
}

/**
 * Chạy toàn bộ bước đồng bộ. Một bước lỗi không được phép làm sập ứng dụng,
 * nên mỗi bước được bọc try/catch riêng và chỉ ghi cảnh báo.
 */
export async function syncDatabaseSchema(
  executeRaw: (sql: string) => Promise<unknown>,
  logger: Logger,
): Promise<void> {
  let failed = 0;

  for (const step of SCHEMA_SYNC_STEPS) {
    try {
      await executeRaw(step.sql);
    } catch (err: any) {
      failed++;
      logger.warn(`⚠️ Bỏ qua bước đồng bộ "${step.label}": ${err.message}`);
    }
  }

  if (failed === 0) {
    logger.log(
      `🧩 Cấu trúc bảng đã khớp với Prisma schema (${SCHEMA_SYNC_STEPS.length}/${SCHEMA_SYNC_STEPS.length} bước).`,
    );
  } else {
    logger.warn(
      `🧩 Đồng bộ cấu trúc bảng hoàn tất với ${failed}/${SCHEMA_SYNC_STEPS.length} bước bị bỏ qua.`,
    );
  }
}
