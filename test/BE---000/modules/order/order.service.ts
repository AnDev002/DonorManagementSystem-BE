import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CartService } from '../../modules/cart/cart.service';
import { PromotionService } from '../../modules/promotion/promotion.service';
import { TrackingService } from '../../modules/tracking/tracking.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventType } from '../../modules/tracking/dto/track-event.dto';
import { PointService } from '../../modules/point/point.service'; // Import service mới
import { PointType, Prisma } from '@prisma/client';
// Giả lập bảng giá dịch vụ gói quà
const GIFT_WRAP_PRICES = [0, 20000, 50000]; 
const CARD_PRICES = [0, 5000, 15000]; 

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    private promotionService: PromotionService,
    private trackingService: TrackingService,
    private pointService: PointService,
  ) {}

  // --- HELPER: Lấy items và check tồn kho ---
  private async resolveItems(userId: string, dto: CreateOrderDto) {
    // [FIX 1] Khai báo kiểu tường minh để tránh lỗi 'never[]'
    let itemsToCheckout: { productId: string; quantity: number }[] = [];

    if (dto.isBuyNow && dto.items?.length) {
      itemsToCheckout = dto.items;
    } else {
      const cart = await this.cartService.getCart(userId);
      if (cart?.items) {
        itemsToCheckout = cart.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity
        }));
      }
    }

    if (!itemsToCheckout.length) throw new BadRequestException('Giỏ hàng trống');

    const productIds = itemsToCheckout.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, stock: true }
    });

    const finalItems = itemsToCheckout.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new NotFoundException(`Sản phẩm ID ${item.productId} không tồn tại`);
      
      if (product.stock < item.quantity) throw new BadRequestException(`Sản phẩm ${product.name} không đủ hàng`);

      return {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: item.quantity,
        subtotal: Number(product.price) * item.quantity
      };
    });

    const subtotal = finalItems.reduce((sum, i) => sum + i.subtotal, 0);
    return { finalItems, subtotal };
  }

  // --- 1. TÍNH TOÁN GIÁ (Preview) ---
  async previewOrder(userId: string, dto: CreateOrderDto) {
    const { finalItems, subtotal } = await this.resolveItems(userId, dto);

    const shippingFee = 30000; 

    let giftFee = 0;
    if (dto.isGift) {
      // [FIX 2] Xử lý undefined index (dùng || 0 để fallback về index 0)
      const wrapPrice = GIFT_WRAP_PRICES[dto.giftWrapIndex || 0] || 0;
      const cardPrice = CARD_PRICES[dto.cardIndex || 0] || 0;
      giftFee = wrapPrice + cardPrice;
    }

    const { totalDiscount, appliedVouchers } = await this.promotionService.validateAndCalculateVouchers(
      dto.voucherIds || [],
      subtotal,
      finalItems
    );

    const coinDiscount = dto.useCoins ? 1000 : 0; 

    const total = Math.max(0, subtotal + shippingFee + giftFee - totalDiscount - coinDiscount);

    return {
      items: finalItems,
      subtotal,
      shippingFee,
      giftFee,
      discounts: {
        voucher: totalDiscount,
        coin: coinDiscount
      },
      appliedVouchers, 
      total
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;

    // Xây dựng điều kiện lọc (Where Input)
    const where: Prisma.OrderWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status as any; // Cast về Enum OrderStatus
    }

    if (search) {
      where.OR = [
        { id: { contains: search } }, // Tìm theo Mã đơn
        { recipientName: { contains: search } }, // Tìm theo tên người nhận
        { user: { email: { contains: search } } }, // Tìm theo email người đặt
      ];
    }

    // Query DB song song (Data + Count)
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          items: true, // Lấy chi tiết items nếu cần hiển thị số lượng
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- 2. TẠO ORDER ---
  async createOrder(userId: string, dto: CreateOrderDto) {
    const preview = await this.previewOrder(userId, dto);
    
    // START TRANSACTION
    const order = await this.prisma.$transaction(async (tx) => {
      // A. Trừ kho
      for (const item of preview.items) {
        const update = await tx.product.updateMany({
          where: { 
            id: item.productId, 
            stock: { gte: item.quantity }
          },
          data: { stock: { decrement: item.quantity } }
        });
        if (update.count === 0) throw new BadRequestException(`Sản phẩm ${item.name} vừa hết hàng.`);
      }

      // B. Xử lý Voucher (Trừ lượt dùng)
      // [FIX 3] Typescript sẽ tự hiểu appliedVouchers là Voucher[] nhờ sửa bên service
      if (preview.appliedVouchers.length > 0) {
        for (const voucher of preview.appliedVouchers) {
          const vUpdate = await tx.voucher.updateMany({
            where: {
              id: voucher.id,
              usageCount: { lt: voucher.usageLimit },
              isActive: true
            },
            data: { usageCount: { increment: 1 } }
          });
          if (vUpdate.count === 0) throw new BadRequestException(`Voucher ${voucher.code} đã hết lượt dùng.`);

          const userVoucher = await tx.userVoucher.findUnique({
             where: { userId_voucherId: { userId, voucherId: voucher.id } }
          });

          if (userVoucher) {
             await tx.userVoucher.update({
               where: { id: userVoucher.id },
               data: { isUsed: true, usedAt: new Date() }
             });
          } else {
             await tx.userVoucher.create({
               data: { userId, voucherId: voucher.id, isUsed: true, usedAt: new Date() }
             });
          }
        }
      }


      // C. Lưu Order
      const receiver = dto.receiverInfo || {};
      
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount: preview.total,
          shippingFee: preview.shippingFee,
          
          recipientName: receiver.name || dto.senderInfo?.name,
          recipientPhone: receiver.phone || dto.senderInfo?.phone,
          recipientAddress: receiver.address || receiver.fullAddress,
          message: dto.isGift ? 'Gửi tặng món quà ý nghĩa' : null,
          isGift: dto.isGift || false,

          paymentMethod: dto.paymentMethod,
          paymentStatus: 'PENDING',

          items: {
            create: preview.items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price
            }))
          },
          
          voucherId: preview.appliedVouchers[0]?.id || null,
        }
      });

      if (!dto.isBuyNow) {
        await this.cartService.clearCart(userId);
      }

      if (dto.useCoins && preview.discounts.coin > 0) {
        const user = await tx.user.findUnique({ where: { id: userId } });

        // === [FIX BẮT ĐẦU] Thêm đoạn kiểm tra này ===
        if (!user) {
           throw new BadRequestException('Người dùng không tồn tại'); 
        }
        // === [FIX KẾT THÚC] ===

        // Bây giờ TypeScript đã biết user không null, lỗi sẽ biến mất
        if (user.points < 1000) throw new BadRequestException('Không đủ xu');
            
        await tx.user.update({
            where: { id: userId },
            data: { points: { decrement: 1000 } }
        });
            
        await tx.pointTransaction.create({
            data: {
                userId,
                amount: -1000,
                type: PointType.SPEND_ORDER, // Đảm bảo bạn đã import Enum PointType
                balanceAfter: user.points - 1000,
                referenceId: `ORDER_SPEND_${Date.now()}`, 
                description: 'Dùng xu giảm giá đơn hàng'
            }
        });
      }
      const rewardPoints = Math.floor(preview.total * 0.01);
      if (rewardPoints > 0) {
            // Lưu ý: Thường xu chỉ được cộng khi đơn hàng "Hoàn thành" (COMPLETED).
            // Nên đoạn này nên đặt ở API update status -> COMPLETED, không phải lúc tạo đơn.
            // Nhưng nếu muốn cộng pending thì lưu vào field pendingPoints của Order.
      }
      return newOrder;
    });

    this.trackingService.trackEvent(userId, 'server', {
      type: EventType.PURCHASE,
      targetId: order.id,
      metadata: { revenue: Number(order.totalAmount), items: preview.items }
    });

    return order;
  }

  async completeOrder(orderId: string) {
      // Tìm order...
      // await this.pointService.processTransaction(order.userId, points, PointType.EARN_ORDER, order.id, "Thưởng mua hàng");
  }
}