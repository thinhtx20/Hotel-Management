import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { RoomsModule } from '../rooms/rooms.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  // InvoicesModule: check-out phải chốt lại hóa đơn qua đúng một chỗ tính tiền
  // duy nhất (InvoicesService.recalculateInvoiceTotals) thay vì tự cộng trừ.
  imports: [RoomsModule, InvoicesModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}

