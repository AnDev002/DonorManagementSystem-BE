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

  async getSellerStats(sellerId: string) {
    // 1. Tính tổng doanh thu
    const revenueResult = await this.prisma.orderItem.aggregate({
      _sum: {
        price: true, // Kiểm tra lại nếu cần nhân quantity: (price * quantity) không hỗ trợ aggregate trực tiếp, phải raw query hoặc tính JS
      },
      where: {
        product: {
          is: {
            sellerId: sellerId, // SỬA: Dùng sellerId
          },
        },
        order: {
          status: OrderStatus.DELIVERED,
        },
      },
    });
    
    // Lưu ý: Prisma aggregate _sum chỉ cộng field. Nếu cần doanh thu chuẩn (price * quantity), 
    // bạn nên lấy list về rồi reduce hoặc dùng $queryRaw. 
    // Code dưới đây là cách tính JS an toàn hơn cho doanh thu:
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


    // 2. Đếm số lượng đơn hàng có chứa sản phẩm của seller này
    const totalOrders = await this.prisma.order.count({
      where: {
        items: {
          some: {
            product: {
              is: {
                  sellerId: sellerId // SỬA: Dùng sellerId
              }
            }
          }
        }
      },
    });

    // 3. Đếm tổng sản phẩm
    const totalProducts = await this.prisma.product.count({
      where: {
        sellerId: sellerId, // SỬA: Dùng sellerId
        // isDeleted: false, // Bỏ comment nếu có field này
      },
    });

    // 4. Đếm sản phẩm sắp hết hàng
    const lowStockProducts = await this.prisma.product.count({
      where: {
        sellerId: sellerId, // SỬA: Dùng sellerId
        stock: {
          lte: 5 
        }
      }
    });

    return {
      revenue: totalRevenue,
      totalOrders,
      totalProducts,
      lowStockProducts,
    };
  }
}