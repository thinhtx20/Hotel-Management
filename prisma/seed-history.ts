import { PrismaClient } from '@prisma/client';
import { HISTORY_YEARS, seedHistoricalYears } from '../src/prisma/history-seed';

/**
 * Nạp RIÊNG dữ liệu lịch sử cho màn "Báo cáo & Hiệu suất" mà KHÔNG xóa dữ liệu
 * đang có (khác với `prisma/seed.ts` - script đó làm sạch toàn bộ CSDL).
 *
 *   npm run db:seed-history                -> nạp các năm mặc định (2024, 2025)
 *   npm run db:seed-history -- 2023 2024   -> chỉ nạp đúng những năm truyền vào
 *   npm run db:seed-history -- --force     -> xóa dữ liệu lịch sử cũ rồi dựng lại
 *
 * Không truyền `--force` thì năm nào đã có dữ liệu sẽ được bỏ qua, nên chạy lại
 * nhiều lần cũng không nhân đôi doanh thu.
 */
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const years = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
  const targetYears = years.length > 0 ? years : HISTORY_YEARS;

  console.log('===========================================================');
  console.log(`📈 NẠP DỮ LIỆU BÁO CÁO CÁC NĂM: ${targetYears.join(', ')}${force ? ' (ghi đè)' : ''}`);
  console.log('===========================================================');

  const summaries = await seedHistoricalYears(prisma, {
    years: targetYears,
    force,
    log: (msg) => console.log(msg),
  });

  if (summaries.length === 0) {
    console.log('\n⚠️ Chưa có phòng / khách hàng / nhân sự trong CSDL.');
    console.log('   Hãy chạy `npm run prisma:seed` trước, hoặc khởi động app một lần để tự tạo dữ liệu nền.');
    return;
  }

  const created = summaries.filter((s) => !s.skipped);
  if (created.length === 0) {
    console.log('\n✅ Các năm yêu cầu đều đã có dữ liệu. Dùng `-- --force` nếu muốn dựng lại.');
    return;
  }

  console.log('\n📊 TỔNG KẾT:');
  for (const s of created) {
    console.log(
      `   • ${s.year}: ${s.bookings} đơn | ${s.invoices} hóa đơn | ` +
        `doanh thu ${s.revenue.toLocaleString('vi-VN')}đ`,
    );
  }
  console.log('\nKiểm tra trên app: Báo cáo -> chọn năm ở ô "Năm 20xx".');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi nạp dữ liệu lịch sử:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
