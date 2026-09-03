import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: PaymentStatus) {
    return this.prisma.invoice.findMany({
      where: status ? { paymentStatus: status } : undefined,
      include: {
        booking: {
          include: {
            customer: { select: { fullName: true, phone: true, email: true } },
            room: { select: { roomNumber: true } },
          },
        },
        issuedBy: { select: { fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: true,
            room: { include: { roomType: true } },
            serviceOrders: true,
          },
        },
        issuedBy: { select: { fullName: true, email: true, role: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn ID: ${id}`);
    }

    return invoice;
  }

  async recordPayment(id: string, dto: RecordPaymentDto, cashierId: string) {
    const invoice = await this.findOne(id);

    const newPaidAmount = invoice.paidAmount + dto.amount;
    const isFullyPaid = newPaidAmount >= invoice.finalAmount;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        paymentMethod: dto.paymentMethod,
        paymentStatus: isFullyPaid
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL,
        notes: dto.notes ? `${invoice.notes || ''}\n${dto.notes}`.trim() : invoice.notes,
        issuedById: cashierId,
        paidAt: isFullyPaid ? new Date() : invoice.paidAt,
      },
    });
  }
}
