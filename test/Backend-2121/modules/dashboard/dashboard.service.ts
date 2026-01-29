import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Kiểm tra lại path này nếu cần
import { OrderStatus, Role } from '@prisma/client'; // Import thêm Role

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    // 1. SỬA: Dùng OrderStatus.DELIVERED thay vì COMPLETED
    const revenueAgg = await this.prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: OrderStatus.DELIVERED, 
      },
    });

    const totalOrders = await this.prisma.order.count();
    const totalUsers = await this.prisma.user.count();

    // 2. SỬA: Đếm Shop bằng cách đếm User có role SELLER (Vì không có bảng Shop riêng)
    const activeShops = await this.prisma.user.count({
      where: {
        role: Role.SELLER,
        // Nếu bạn muốn lọc shop đã xác thực/hoạt động:
        // isVerified: true, 
      },
    });

    return {
      totalRevenue: Number(revenueAgg._sum.totalAmount) || 0, // Convert Decimal to Number để FE dễ đọc
      totalOrders,
      totalUsers,
      activeShops,
    };
  }
}