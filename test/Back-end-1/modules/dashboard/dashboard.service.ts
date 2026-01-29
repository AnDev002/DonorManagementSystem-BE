import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { OrderStatus, Role } from '@prisma/client';
// [FIX] Sửa dòng import này:
import moment from 'moment'; 

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const revenueAgg = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: OrderStatus.DELIVERED },
    });

    const totalOrders = await this.prisma.order.count();
    const totalUsers = await this.prisma.user.count();
    const activeShops = await this.prisma.user.count({
      where: { role: Role.SELLER },
    });

    return {
      totalRevenue: Number(revenueAgg._sum.totalAmount) || 0,
      totalOrders,
      totalUsers,
      activeShops,
    };
  }

  async getSellerStats(sellerId: string) {
    // 1. Doanh thu tổng
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

    // 2. Các chỉ số đếm
    const totalOrders = await this.prisma.order.count({
      where: { items: { some: { product: { is: { sellerId } } } } },
    });

    const totalProducts = await this.prisma.product.count({
      where: { sellerId },
    });

    const lowStockProducts = await this.prisma.product.count({
      where: { sellerId, stock: { lte: 5 } }
    });

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
        status: { in: ['RETURNED', 'CANCELLED'] as any }, 
        items: { some: { product: { is: { sellerId } } } }
      }
    });

    // Chart Data
    const chartData: { date: string; revenue: number }[] = [];
    
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

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
        date: moment(startOfDay).format('DD/MM'), // Bây giờ hàm này sẽ hoạt động
        revenue: dailyRevenue
      });
    }

    return {
      revenue: totalRevenue,
      orders: totalOrders,
      products: totalProducts,
      rating: 4.8, 
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