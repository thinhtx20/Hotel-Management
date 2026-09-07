import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentEntryStatus,
  PaymentEntryType,
  PaymentMethod,
  Role,
  ShiftStatus,
  ShiftType,
  WorkShift,
} from '@prisma/client';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { QueryShiftsDto } from './dto/query-shifts.dto';
import { endOfDay, roundMoney, startOfDay } from '../common/utils/revenue.util';

export interface ShiftStats {
  initialCash: number;
  cashCollected: number;
  cashRefunded: number;
  netCashChange: number;
  expectedCash: number;
  creditCardAmount: number;
  bankTransferAmount: number;
  totalRevenue: number;
  paymentCount: number;
  refundCount: number;
}

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sinh mã ca trực chuẩn: SFT-YYYYMMDD-XXXX
   */
  private async generateShiftCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SFT-${dateStr}`;

    const count = await this.prisma.workShift.count({
      where: {
        shiftCode: { startsWith: prefix },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Tìm ca trực đang OPEN của một nhân viên (dùng để gán shiftId tự động khi thanh toán)
   */
  async getActiveShiftForStaff(staffId: string): Promise<WorkShift | null> {
    if (!staffId) return null;
    return this.prisma.workShift.findFirst({
      where: {
        staffId,
        status: ShiftStatus.OPEN,
      },
    });
  }

  /**
   * Mở ca trực mới tại quầy
   */
  async openShift(staffId: string, dto: OpenShiftDto) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, fullName: true, role: true, isActive: true },
    });

    if (!staff || !staff.isActive) {
      throw new BadRequestException('Tài khoản nhân viên không tồn tại hoặc đã bị khóa');
    }

    if (staff.role !== Role.RECEPTIONIST && staff.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ nhân viên Lễ tân hoặc Quản trị viên mới được mở ca trực tại quầy');
    }

    // Kiểm tra xem nhân viên đã có ca nào đang OPEN chưa
    const existingOpenShift = await this.prisma.workShift.findFirst({
      where: { staffId, status: ShiftStatus.OPEN },
    });

    if (existingOpenShift) {
      throw new BadRequestException(
        `Bạn đang có ca trực "${existingOpenShift.shiftCode}" chưa chốt. ` +
          `Vui lòng chốt ca cũ trước khi mở ca làm việc mới.`,
      );
    }

    const shiftCode = await this.generateShiftCode();
    const initialCash = roundMoney(dto.initialCash);

    const shift = await this.prisma.workShift.create({
      data: {
        shiftCode,
        staffId,
        shiftType: dto.shiftType,
        deskName: dto.deskName?.trim() || 'Quầy Lễ Tân',
        status: ShiftStatus.OPEN,
        initialCash,
        openNote: dto.note?.trim() || null,
        startTime: new Date(),
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    this.logger.log(
      `[Shifts] Nhân viên ${staff.fullName} đã mở ca trực "${shiftCode}" (${dto.shiftType}) với ${initialCash.toLocaleString('vi-VN')}đ tiền két đầu ca.`,
    );

    const stats = await this.calculateShiftStats(shift);
    return { ...shift, stats };
  }

  /**
   * Tính toán doanh thu và dòng tiền trong ca trực theo thời gian thực
   */
  async calculateShiftStats(shift: WorkShift): Promise<ShiftStats> {
    const timeEnd = shift.endTime || new Date();

    // Tìm các giao dịch đã CONFIRMED liên kết với ca này
    // (hoặc do chính thu ngân xác nhận trong khoảng thời gian của ca)
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentEntryStatus.CONFIRMED,
        OR: [
          { shiftId: shift.id },
          {
            confirmedById: shift.staffId,
            confirmedAt: {
              gte: shift.startTime,
              lte: timeEnd,
            },
          },
        ],
      },
      select: {
        id: true,
        amount: true,
        method: true,
        type: true,
      },
    });

    let cashCollected = 0;
    let cashRefunded = 0;
    let creditCardAmount = 0;
    let bankTransferAmount = 0;
    let paymentCount = 0;
    let refundCount = 0;

    for (const p of payments) {
      if (p.type === PaymentEntryType.REFUND) {
        refundCount++;
        if (p.method === PaymentMethod.CASH) {
          cashRefunded += p.amount;
        } else if (p.method === PaymentMethod.CREDIT_CARD) {
          creditCardAmount -= p.amount;
        } else if (p.method === PaymentMethod.BANK_TRANSFER) {
          bankTransferAmount -= p.amount;
        }
      } else {
        paymentCount++;
        if (p.method === PaymentMethod.CASH) {
          cashCollected += p.amount;
        } else if (p.method === PaymentMethod.CREDIT_CARD) {
          creditCardAmount += p.amount;
        } else if (p.method === PaymentMethod.BANK_TRANSFER) {
          bankTransferAmount += p.amount;
        }
      }
    }

    cashCollected = roundMoney(cashCollected);
    cashRefunded = roundMoney(cashRefunded);
    creditCardAmount = roundMoney(creditCardAmount);
    bankTransferAmount = roundMoney(bankTransferAmount);

    const netCashChange = roundMoney(cashCollected - cashRefunded);
    const expectedCash = roundMoney(shift.initialCash + netCashChange);
    const totalRevenue = roundMoney(netCashChange + creditCardAmount + bankTransferAmount);

    return {
      initialCash: shift.initialCash,
      cashCollected,
      cashRefunded,
      netCashChange,
      expectedCash,
      creditCardAmount,
      bankTransferAmount,
      totalRevenue,
      paymentCount,
      refundCount,
    };
  }

  /**
   * Lấy ca trực hiện tại của nhân viên đang đăng nhập
   */
  async getCurrentShift(staffId: string) {
    const shift = await this.prisma.workShift.findFirst({
      where: {
        staffId,
        status: ShiftStatus.OPEN,
      },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    if (!shift) {
      return null;
    }

    const stats = await this.calculateShiftStats(shift);
    return { ...shift, stats };
  }

  /**
   * Lấy danh sách tất cả các ca đang OPEN tại quầy (Cho Admin & Dashboard)
   */
  async getActiveShifts() {
    const shifts = await this.prisma.workShift.findMany({
      where: { status: ShiftStatus.OPEN },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return Promise.all(
      shifts.map(async (shift) => {
        const stats = await this.calculateShiftStats(shift);
        return {
          id: shift.id,
          shiftCode: shift.shiftCode,
          staffId: shift.staffId,
          staffName: shift.staff.fullName,
          staffAvatar: shift.staff.avatar,
          staffPhone: shift.staff.phone,
          shiftType: shift.shiftType,
          deskName: shift.deskName,
          status: shift.status,
          startTime: shift.startTime,
          initialCash: shift.initialCash,
          currentExpectedCash: stats.expectedCash,
          totalRevenueSoFar: stats.totalRevenue,
          stats,
        };
      }),
    );
  }

  /**
   * Chốt ca trực & bàn giao quỹ tiền két
   */
  async closeShift(staffId: string, dto: CloseShiftDto, currentShiftId?: string) {
    let shift = currentShiftId
      ? await this.prisma.workShift.findUnique({
          where: { id: currentShiftId },
          include: { staff: true },
        })
      : await this.prisma.workShift.findFirst({
          where: { staffId, status: ShiftStatus.OPEN },
          include: { staff: true },
        });

    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca trực đang mở cần chốt');
    }

    if (shift.status !== ShiftStatus.OPEN) {
      throw new BadRequestException(`Ca trực "${shift.shiftCode}" đã được chốt trước đó`);
    }

    // Kiểm tra nhân viên nhận bàn giao (nếu có truyền)
    let handoverStaffName: string | null = null;
    if (dto.handoverStaffId) {
      const handoverUser = await this.prisma.user.findUnique({
        where: { id: dto.handoverStaffId },
        select: { id: true, fullName: true, role: true },
      });
      if (!handoverUser) {
        throw new BadRequestException('Nhân viên nhận bàn giao không tồn tại trong hệ thống');
      }
      handoverStaffName = handoverUser.fullName;
    }

    const stats = await this.calculateShiftStats(shift);
    const actualCash = roundMoney(dto.actualCash);
    const expectedCash = stats.expectedCash;
    const cashDifference = roundMoney(actualCash - expectedCash);

    // Nếu tiền lệch, bắt buộc giải trình lý do
    if (cashDifference !== 0 && (!dto.differenceReason || !dto.differenceReason.trim())) {
      const sign = cashDifference > 0 ? '+' : '';
      throw new BadRequestException(
        `Số tiền thực tế kiểm đếm lệch so với sổ sách (${sign}${cashDifference.toLocaleString('vi-VN')}đ). ` +
          `Vui lòng nhập lý do giải trình chênh lệch quỹ (differenceReason).`,
      );
    }

    const endTime = new Date();

    // Cập nhật ca sang CLOSED và snapshot số liệu
    const updatedShift = await this.prisma.$transaction(async (tx) => {
      // Gắn shiftId cho các payment phát sinh trong ca nếu chưa có
      await tx.payment.updateMany({
        where: {
          shiftId: null,
          confirmedById: shift.staffId,
          confirmedAt: {
            gte: shift.startTime,
            lte: endTime,
          },
        },
        data: {
          shiftId: shift.id,
        },
      });

      return tx.workShift.update({
        where: { id: shift.id },
        data: {
          status: ShiftStatus.CLOSED,
          endTime,
          actualCash,
          expectedCash,
          cashDifference,
          creditCardAmount: stats.creditCardAmount,
          bankTransferAmount: stats.bankTransferAmount,
          totalRevenue: stats.totalRevenue,
          closeNote: dto.closeNote?.trim() || null,
          differenceReason: dto.differenceReason?.trim() || null,
          handoverStaffId: dto.handoverStaffId || null,
        },
        include: {
          staff: {
            select: { id: true, fullName: true, email: true, phone: true, avatar: true },
          },
          handoverStaff: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      });
    });

    this.logger.log(
      `[Shifts] Đã chốt ca "${updatedShift.shiftCode}". Tiền thực tế: ${actualCash.toLocaleString('vi-VN')}đ, Sổ sách: ${expectedCash.toLocaleString('vi-VN')}đ, Lệch: ${cashDifference.toLocaleString('vi-VN')}đ.`,
    );

    return {
      ...updatedShift,
      stats,
      handoverStaffName,
    };
  }

  /**
   * Tra cứu danh sách lịch sử ca trực (phân trang & bộ lọc)
   */
  async findAll(query: QueryShiftsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.staffId) {
      where.staffId = query.staffId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.shiftType) {
      where.shiftType = query.shiftType;
    }

    if (query.fromDate || query.toDate) {
      where.startTime = {};
      if (query.fromDate) {
        where.startTime.gte = startOfDay(new Date(query.fromDate));
      }
      if (query.toDate) {
        where.startTime.lte = endOfDay(new Date(query.toDate));
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.workShift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: {
          staff: {
            select: { id: true, fullName: true, email: true, phone: true, avatar: true },
          },
          handoverStaff: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      }),
      this.prisma.workShift.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Xem chi tiết một ca trực cụ thể kèm danh sách giao dịch
   */
  async findOne(id: string) {
    const shift = await this.prisma.workShift.findUnique({
      where: { id },
      include: {
        staff: {
          select: { id: true, fullName: true, email: true, phone: true, avatar: true },
        },
        handoverStaff: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        payments: {
          orderBy: { confirmedAt: 'desc' },
          include: {
            invoice: {
              select: {
                invoiceCode: true,
                booking: {
                  select: {
                    bookingCode: true,
                    room: { select: { roomNumber: true } },
                    customer: { select: { fullName: true, phone: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException(`Không tìm thấy ca trực với mã ID: ${id}`);
    }

    const stats = await this.calculateShiftStats(shift);

    return {
      ...shift,
      stats,
    };
  }
}
