import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { OrderStatus, PayoutStatus, WalletTransactionType } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // API 1: Thống kê doanh thu (Giả định đơn DELIVERED là doanh thu thực)
  async getRevenueStats(period: string) {
    // 1. Tổng GMV (Gross Merchandise Value) toàn sàn
    const totalRevenueAgg = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: OrderStatus.DELIVERED },
    });
    
    const totalRevenue = Number(totalRevenueAgg._sum.totalAmount) || 0;

    // 2. Tính toán "Phí sàn" (Giả sử sàn thu 5% mỗi đơn)
    // Trong thực tế, bạn nên lưu field `platformFee` trong Order model
    const platformFee = totalRevenue * 0.05; 

    // 3. Số tiền đang chờ giải ngân (Payout PENDING)
    const pendingPayoutAgg = await this.prisma.payoutRequest.aggregate({
      _sum: { amount: true },
      where: { status: PayoutStatus.PENDING },
    });

    // 4. Chart Data (Mock data cho biểu đồ vì query group-by date trong Prisma khá phức tạp tùy DB)
    // Nếu dùng PostgreSQL, có thể dùng raw query. Ở đây trả về mock structure để FE render.
    const chartData = [
      { date: '2024-01', value: totalRevenue * 0.2 },
      { date: '2024-02', value: totalRevenue * 0.3 },
      { date: '2024-03', value: totalRevenue * 0.5 },
    ];

    return {
      totalRevenue,
      platformFee,
      pendingPayout: Number(pendingPayoutAgg._sum.amount) || 0,
      chartData
    };
  }

  // API 2: Lấy danh sách rút tiền
  async getPayoutRequests(page: number, status?: string) {
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status as PayoutStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { shopName: true, email: true } } }, // Lấy tên Shop
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);

    // Map data về format FE cần
    const mappedData = data.map(item => ({
      id: item.id,
      shopId: item.userId,
      shopName: item.user.shopName || item.user.email,
      amount: Number(item.amount),
      bankInfo: item.bankInfo,
      status: item.status,
      requestedAt: item.createdAt,
      processedAt: item.processedAt,
    }));

    return {
      data: mappedData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  // API 3: Duyệt rút tiền (Trừ tiền trong ví Seller - Logic: Đã trừ lúc tạo request hay trừ lúc duyệt?)
  // THƯỜNG GẶP: Seller tạo request -> Tiền bị trừ (hoặc đóng băng). Admin duyệt -> Status thành Approved.
  // Ở đây giả sử: Tiền đã bị trừ khỏi ví khả dụng khi Seller bấm "Rút tiền". Admin chỉ confirm status.
  async approvePayout(id: string) {
    const request = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!request || request.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã xử lý');
    }

    // Cập nhật status -> APPROVED
    await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: PayoutStatus.APPROVED,
        processedAt: new Date(),
      },
    });

    // Tạo log giao dịch hệ thống (Optional)
    await this.prisma.walletTransaction.create({
      data: {
        userId: request.userId,
        amount: -request.amount, // Ghi nhận dòng tiền đi ra
        type: WalletTransactionType.PAYOUT,
        status: 'COMPLETED',
        referenceId: request.id,
        description: `Admin approved payout #${request.id}`,
      }
    });

    return { success: true };
  }

  // API 4: Từ chối rút tiền (Hoàn lại tiền vào ví Seller)
  async rejectPayout(id: string, reason: string) {
    const request = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!request || request.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không hợp lệ');
    }

    // 1. Cập nhật status -> REJECTED
    await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: PayoutStatus.REJECTED,
        reason,
        processedAt: new Date(),
      },
    });

    // 2. Hoàn tiền lại ví cho Seller
    await this.prisma.user.update({
      where: { id: request.userId },
      data: {
        walletBalance: { increment: request.amount }
      }
    });

    // 3. Log giao dịch hoàn tiền
    await this.prisma.walletTransaction.create({
      data: {
        userId: request.userId,
        amount: request.amount,
        type: WalletTransactionType.REFUND,
        status: 'COMPLETED',
        referenceId: request.id,
        description: `Refund rejected payout #${request.id}: ${reason}`,
      }
    });

    return { success: true };
  }
}