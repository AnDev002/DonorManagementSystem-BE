import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Kiểm tra lại path này nếu cần
import { OrderStatus, Role } from '@prisma/client'; // Import thêm Role
import * as moment from 'moment';
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

  async getSellerStats(sellerId: string) {
    // 1. Tính tổng doanh thu & đơn hàng thành công
    const soldItems = await this.prisma.orderItem.findMany({
      where: {
          product: { is: { sellerId: sellerId } },
          order: { status: OrderStatus.DELIVERED }
      },
      select: { price: true, quantity: true }
    });
    
    const totalRevenue = soldItems.reduce((acc, item) => {
        return acc + (Number(item.price) * item.quantity);
    }, 0);

    // 2. Tổng số đơn hàng (liên quan đến seller)
    const totalOrders = await this.prisma.order.count({
      where: { items: { some: { product: { is: { sellerId } } } } },
    });

    // 3. Tổng sản phẩm & sản phẩm sắp hết hàng
    const totalProducts = await this.prisma.product.count({
      where: { sellerId },
    });

    const lowStockProducts = await this.prisma.product.count({
      where: { sellerId, stock: { lte: 5 } }
    });

    // --- PHẦN MỚI: Todo List Stats (Đếm trạng thái đơn) ---
    const pendingOrders = await this.prisma.order.count({
      where: { 
        status: OrderStatus.PENDING,
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    const shippingOrders = await this.prisma.order.count({
      where: { 
        status: OrderStatus.SHIPPING,
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    const returnedOrders = await this.prisma.order.count({
      where: { 
        // Giả sử có trạng thái RETURNED hoặc CANCELLED
        status: { in: ['RETURNED', 'CANCELLED'] as any }, 
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    // --- PHẦN MỚI: Chart Data (Doanh thu 7 ngày qua) ---
    const chartData: { date: string; revenue: number }[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      // Lấy các item bán được trong ngày này
      const dailyItems = await this.prisma.orderItem.findMany({
        where: {
          product: { is: { sellerId } },
          order: {
            status: OrderStatus.DELIVERED,
            updatedAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        },
        select: { price: true, quantity: true }
      });

      const dailyRevenue = dailyItems.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);
      
      chartData.push({
        date: moment(startOfDay).format('DD/MM'), // Format ngày hiển thị
        revenue: dailyRevenue
      });
    }

    // Tính Rating trung bình (nếu có bảng Review)
    // Tạm thời mock hoặc query từ bảng Review nếu bạn đã có
    const rating = 4.8; 

    return {
      revenue: totalRevenue,
      orders: totalOrders,
      products: totalProducts,
      rating: rating,
      lowStockProducts,
      todo: {
        pending: pendingOrders,
        shipping: shippingOrders,
        returned: returnedOrders
      },
      chart: chartData
    };
  }
}