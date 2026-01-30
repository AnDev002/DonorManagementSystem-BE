import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CartService } from '../../modules/cart/cart.service';
import { PromotionService } from '../../modules/promotion/promotion.service';
import { TrackingService } from '../../modules/tracking/tracking.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventType } from '../../modules/tracking/dto/track-event.dto';
import { PointService } from '../../modules/point/point.service';
import { OrderStatus, PointType, Prisma } from '@prisma/client';
import { GhnService } from '../../modules/ghn/ghn.service';
import { PaymentService } from '../payment/payment.service';

const GIFT_WRAP_PRICES = [0, 20000, 50000]; 
const CARD_PRICES = [0, 5000, 15000]; 

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    private promotionService: PromotionService,
    private trackingService: TrackingService,
    private pointService: PointService,
    private ghnService: GhnService,
    private paymentService: PaymentService
  ) {}

  // --- HELPER: Lấy items và check tồn kho & tính khối lượng ---
  private async resolveItems(userId: string, dto: CreateOrderDto) {
    let itemsToCheckout: { productId: string; quantity: number; productVariantId?: number | string }[] = [];

    if (dto.isBuyNow && dto.items?.length) {
      itemsToCheckout = dto.items;
    } else {
      const cart = await this.cartService.getCart(userId);
      if (cart?.items) {
        itemsToCheckout = cart.items.map(i => {
          // [FIX ERROR 1] Ép kiểu (i as any) vì interface trả về từ getCart đang thiếu productVariantId
          const itemAny = i as any;
          return {
            productId: i.productId,
            quantity: i.quantity,
            productVariantId: itemAny.productVariantId || itemAny.variantId 
          };
        });
      }
    }

    if (!itemsToCheckout.length) throw new BadRequestException('Giỏ hàng trống');

    const productIds = itemsToCheckout.map(i => i.productId);
    
    // Query DB
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { 
          id: true, 
          name: true, 
          price: true, 
          originalPrice: true, 
          stock: true, 
          weight: true,
          images: true,        
          variants: true       
      } 
    });

    const finalItems = itemsToCheckout.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new NotFoundException(`Sản phẩm ID ${item.productId} không tồn tại`);
      
      if (product.stock < item.quantity) throw new BadRequestException(`Sản phẩm ${product.name} không đủ hàng`);

      const itemWeight = (product.weight || 200);

      // [FIX ERROR 2, 3, 4] Xử lý Variant và các lỗi về color/size
      // Khai báo kiểu any cho selectedVariant để tránh lỗi TS nếu model thiếu field
      let selectedVariant: any = null; 
      let finalPrice = Number(product.price);
      let finalColor = undefined;
      let finalSize = undefined;

      if (item.productVariantId && product.variants?.length) {
          // [FIX ERROR 2] Dùng '|| null' để đảm bảo không bị undefined
          // Dùng String() để so sánh an toàn giữa int và string uuid
          selectedVariant = product.variants.find(v => String(v.id) === String(item.productVariantId)) || null;
          
          if (selectedVariant) {
              // Nếu bạn muốn dùng giá của variant (nếu có logic này)
              // finalPrice = Number(selectedVariant.price); 

              // [FIX ERROR 3, 4] Truy cập an toàn vào color/size thông qua kiểu any
              // Lưu ý: Nếu DB thực sự không có cột color/size, giá trị này sẽ là undefined (không sao)
              finalColor = selectedVariant.color || (selectedVariant as any).name || undefined; 
              finalSize = selectedVariant.size || undefined;   
          }
      }

      // [FIX ERROR 5] Ép kiểu images từ JsonValue sang string[]
      // Kiểm tra kỹ xem nó có phải là mảng không trước khi truy cập .length
      const productImages = product.images as unknown as string[];
      const finalImageUrl = (Array.isArray(productImages) && productImages.length > 0)
          ? productImages[0] 
          : '/assets/placeholder.png';

      return {
        productId: product.id,
        productVariantId: item.productVariantId, 
        name: product.name,
        imageUrl: finalImageUrl, 
        
        price: finalPrice,
        originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined, 
        
        color: finalColor, 
        size: finalSize,   
        
        quantity: item.quantity,
        subtotal: finalPrice * item.quantity,
        weight: itemWeight * item.quantity, 
      };
    });

    const subtotal = finalItems.reduce((sum, i) => sum + i.subtotal, 0);
    return { finalItems, subtotal };
  }

  // --- 1. TÍNH TOÁN GIÁ & PHÍ SHIP (Preview) ---
  async previewOrder(userId: string, dto: CreateOrderDto) {
    const { finalItems, subtotal } = await this.resolveItems(userId, dto);

    // [GHN UPDATE] Tính tổng khối lượng đơn hàng
    const totalWeight = finalItems.reduce((sum, item) => sum + item.weight, 0);

    // [GHN UPDATE] Tính phí ship động
    let shippingFee = 30000; // Giá fallback
    const receiver = dto.receiverInfo;

    // Yêu cầu DTO receiverInfo phải có districtId và wardCode (được gửi từ Frontend)
    if (receiver && receiver['districtId'] && receiver['wardCode']) {
        try {
            shippingFee = await this.ghnService.calculateFee({
                toDistrictId: Number(receiver['districtId']),
                toWardCode: String(receiver['wardCode']),
                weight: totalWeight,
                insuranceValue: subtotal // Khai báo giá trị để tính bảo hiểm
            });
        } catch (error) {
            this.logger.warn('Không thể tính phí GHN, dùng phí mặc định', error);
        }
    }

    let giftFee = 0;
    if (dto.isGift) {
      const wrapPrice = GIFT_WRAP_PRICES[dto.giftWrapIndex || 0] || 0;
      const cardPrice = CARD_PRICES[dto.cardIndex || 0] || 0;
      giftFee = wrapPrice + cardPrice;
    }

    const { totalDiscount, appliedVouchers } = await this.promotionService.validateAndCalculateVouchers(
      dto.voucherIds || [],
      subtotal,
      finalItems
    );

    let coinDiscount = 0;
    if (dto.useCoins) {
        // Lấy ví điểm của user
        const wallet = await this.prisma.pointWallet.findUnique({ where: { userId } });
        const userPoints = wallet?.balance || 0;
        
        // Logic: Dùng tối đa 1000 xu HOẶC dùng hết số xu đang có nếu ít hơn 1000
        // Ví dụ: Có 500 xu -> coinDiscount = 500. Có 2000 xu -> coinDiscount = 1000.
        coinDiscount = Math.min(userPoints, 1000); 
    }

    // Đảm bảo không âm
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

  // ... (Hàm findAll giữ nguyên) ...
  async findAll(params: { page?: number; limit?: number; status?: string; search?: string; }) {
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {};
    if (status && status !== 'ALL') { where.status = status as any; }
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { recipientName: { contains: search } },
        { user: { email: { contains: search } } },
      ];
    }
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } }, items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: orders, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) } };
  }
  async updateOrderStatus(orderId: string, sellerId: string, status: OrderStatus) {
    // Kiểm tra quyền: Order này phải chứa sản phẩm của Shop thuộc Seller này
    // (Trong schema của bạn, Order chưa có shopId trực tiếp, 
    // nhưng ta có thể check qua items -> product -> sellerId)
    
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } }
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    // Cập nhật trạng thái
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status }
    });
  }
  async getSellerOrders(userId: string, status?: string) {
    // 1. Tìm shop của user
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) return []; 

    // [SỬA LỖI] Chuẩn hóa status để bỏ qua trường hợp 'all' hoặc 'ALL' hoặc rỗng
    const shouldFilterStatus = status && status.toLowerCase() !== 'all';

    // 2. Query Orders
    return this.prisma.order.findMany({
      where: {
        items: {
          some: {
            product: { shopId: shop.id } 
          }
        },
        // Chỉ thêm điều kiện status nếu status hợp lệ và không phải là 'all'
        ...(shouldFilterStatus ? { status: status as any } : {})
      },
      include: {
        user: { select: { name: true, phone: true } },
        items: { 
          where: {
             product: { shopId: shop.id } 
          },
          include: { product: true } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  // --- 3. HỦY ĐƠN HÀNG (User) ---
  async cancelOrder(userId: string, orderId: string) {
    // 1. Tìm đơn hàng & Validate quyền sở hữu
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, voucher: true }
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    // 2. Validate trạng thái: Chỉ cho hủy khi PENDING (Chờ xác nhận)
    // Nếu muốn cho hủy khi 'CONFIRMED' (đã đóng gói nhưng chưa giao), bạn có thể thêm vào điều kiện.
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Không thể hủy đơn hàng đã được xác nhận hoặc đang vận chuyển.');
    }

    // 3. Thực hiện Transaction hoàn tác
    return this.prisma.$transaction(async (tx) => {
      // A. Cập nhật trạng thái đơn hàng
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' }
      });

      // B. Hoàn lại tồn kho (Stock)
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId ?? undefined },
          data: { stock: { increment: item.quantity } }
        });
      }

      // C. Hoàn lại Xu (Nếu có dùng)
      // Logic: Kiểm tra log point history hoặc tính lại từ order (giả sử logic discount coin lưu ở order field khác hoặc tự tính)
      // Ở đây ta giả định nếu có logic trừ xu, ta cần hoàn lại ví.
      // Do schema Order hiện tại chưa thấy field `coinDiscountAmount`, ta tạm bỏ qua hoặc bạn cần thêm field này vào model Order.
      // Dưới đây là ví dụ nếu bạn lưu coinDiscount:
      /* if (order.coinDiscount > 0) {
          await tx.pointWallet.update({
            where: { userId },
            data: { balance: { increment: order.coinDiscount } }
          });
          // Log history hoàn xu...
      }
      */

      // D. Hoàn lại lượt dùng Voucher (Nếu có)
      if (order.voucherId) {
        await tx.voucher.update({
          where: { id: order.voucherId },
          data: { usageCount: { decrement: 1 } }
        });
        
        // Cập nhật UserVoucher thành chưa dùng
        await tx.userVoucher.updateMany({
          where: { userId, voucherId: order.voucherId },
          data: { isUsed: false, usedAt: null }
        });
      }

      // E. Tracking/Log
      // this.trackingService.trackEvent(...) 

      return updatedOrder;
    });
  }
  // --- 2. TẠO ORDER ---
  async createOrder(userId: string, dto: CreateOrderDto) {
    const preview = await this.previewOrder(userId, dto);
    const order = await this.prisma.$transaction(async (tx) => {
      // A. Trừ kho
      for (const item of preview.items) {
        const update = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (update.count === 0) throw new BadRequestException(`Sản phẩm ${item.name} vừa hết hàng.`);
      }

      // B. Xử lý Voucher
      if (preview.appliedVouchers.length > 0) {
        for (const voucher of preview.appliedVouchers) {
          const vUpdate = await tx.voucher.updateMany({
            where: { id: voucher.id, usageCount: { lt: voucher.usageLimit }, isActive: true },
            data: { usageCount: { increment: 1 } }
          });
          if (vUpdate.count === 0) throw new BadRequestException(`Voucher ${voucher.code} đã hết lượt dùng.`);

          const userVoucher = await tx.userVoucher.findUnique({
              where: { userId_voucherId: { userId, voucherId: voucher.id } }
          });
          if (userVoucher) {
             await tx.userVoucher.update({ where: { id: userVoucher.id }, data: { isUsed: true, usedAt: new Date() } });
          } else {
             await tx.userVoucher.create({ data: { userId, voucherId: voucher.id, isUsed: true, usedAt: new Date() } });
          }
        }
      }

      // C. Lưu Order vào DB
      const receiver = dto.receiverInfo || {};
      
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount: preview.total,
          shippingFee: preview.shippingFee, // Lưu phí ship GHN vào DB
          
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

      if (!dto.isBuyNow) await this.cartService.clearCart(userId);

      // D. Trừ Xu
      if (dto.useCoins && preview.discounts.coin > 0) {
        // [FIX] Lấy số lượng xu cần trừ từ kết quả preview (vd: 500)
        const amountToDeduct = preview.discounts.coin;

        const wallet = await tx.pointWallet.findUnique({ where: { userId } });
        
        // Check xem có đủ số xu dự kiến không (thường là đủ vì đã tính ở preview)
        if (!wallet || wallet.balance < amountToDeduct) {
            throw new BadRequestException(`Không đủ xu. Bạn có ${wallet?.balance || 0}, cần ${amountToDeduct}.`);
        }
            
        await tx.pointWallet.update({
            where: { userId },
            data: { balance: { decrement: amountToDeduct } } // [FIX] Trừ đúng số amountToDeduct
        });
            
        await tx.pointHistory.create({
            data: {
                userId,
                amount: -amountToDeduct, // [FIX] Lưu log đúng số tiền trừ
                type: PointType.SPEND_ORDER,
                source: 'ORDER',
                description: `Dùng ${amountToDeduct} xu giảm giá đơn hàng`
            }
        });
      }

      return newOrder;
    });

    // --- [GHN INTEGRATION] TẠO ĐƠN GHN ---
    // Chỉ tạo đơn GHN khi phương thức là COD hoặc (nếu muốn) sau khi thanh toán Online thành công.
    // Ở đây ta làm mẫu cho trường hợp COD.
    
    let paymentUrl: any = null;
    if (order && dto.paymentMethod === 'cod') {
        try {
            const receiver = dto.receiverInfo || {};
            
            const ghnOrderData = {
                to_name: order.recipientName,
                to_phone: order.recipientPhone,
                to_address: order.recipientAddress,
                to_ward_code: receiver['wardCode'],
                to_district_id: Number(receiver['districtId']),
                
                // [FIX LỖI TẠI ĐÂY] Ép kiểu về số nguyên (Integer)
                cod_amount: Math.floor(Number(order.totalAmount)), 

                weight: preview.items.reduce((sum, i) => sum + (i.weight || 200), 0),
                items: preview.items.map(i => ({
                    name: i.name,
                    code: i.productId,
                    quantity: i.quantity,
                    price: Number(i.price), // [Nên ép kiểu cả giá sản phẩm cho chắc chắn]
                    weight: i.weight || 200
                })),
                note: `Đơn hàng #${order.id} từ Gmall`,
                required_note: 'CHOXEMHANGKHONGTHU'
            };

            const ghnResponse = await this.ghnService.createShippingOrder(ghnOrderData);

            // Cập nhật lại Order với Mã vận đơn từ GHN
            if (ghnResponse && ghnResponse.order_code) {
                await this.prisma.order.update({
                    where: { id: order.id },
                    data: { 
                        shippingOrderCode: ghnResponse.order_code,
                        // Có thể cập nhật lại fee nếu muốn khớp 100% với lúc tạo
                        // shippingFee: ghnResponse.total_fee 
                    }
                });
                this.logger.log(`Tạo đơn GHN thành công: ${ghnResponse.order_code}`);
            }
        } catch (error) {
            // Không throw lỗi ở đây để tránh rollback đơn hàng đã tạo trong DB
            this.logger.error('Lỗi khi đẩy đơn sang GHN:', error);
            // TODO: Bắn noti cho Admin hoặc đánh dấu đơn cần xử lý thủ công
        }
    }
    else if (dto.paymentMethod === 'pay2s') {
        try {
            // Gọi service tạo link (đảm bảo bạn đã inject PaymentService)
            paymentUrl = await this.paymentService.createPay2SPayment(order.id, Number(order.totalAmount));
        } catch (error) {
            this.logger.error(`Lỗi tạo Pay2S: ${error.message}`);
            // Không throw lỗi để tránh rollback đơn hàng
        }
    }

    this.trackingService.trackEvent(userId, 'server', {
      type: EventType.PURCHASE,
      targetId: order.id,
      metadata: { revenue: Number(order.totalAmount), items: preview.items }
    });

    return {
        order,
        paymentUrl 
    };
  }

  async getUserOrders(userId: string, status?: string) {
    const whereCondition: any = {
      userId: userId, // Luôn luôn lọc theo user đang đăng nhập
    };

    // Nếu status được gửi lên và khác rỗng thì mới filter
    // Frontend gửi lên dạng UPPERCASE (PENDING, SHIPPING...) nên ta dùng trực tiếp
    if (status && status.trim() !== '') {
        // Map status từ query sang Enum của Prisma nếu cần, hoặc dùng trực tiếp nếu trùng khớp
        whereCondition.status = status; 
    }

    return this.prisma.order.findMany({
      where: whereCondition,
      include: {
        // Include items và product để hiển thị ảnh, tên sản phẩm ở list bên ngoài
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                images: true, // Cần lấy ảnh để hiển thị thumbnail
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc', // Sắp xếp đơn mới nhất lên đầu
      },
    });
  }

  async completeOrder(orderId: string) {
      // Logic hoàn thành đơn hàng...
  }
  async getSellerOrderDetail(orderId: string, sellerId: string) {
    // 1. Tìm shop của seller
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: sellerId } });
    if (!shop) throw new NotFoundException('Shop không tồn tại');

    // 2. Tìm đơn hàng có chứa sản phẩm của shop này
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        items: {
          some: { product: { shopId: shop.id } }
        }
      },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: {
          where: { product: { shopId: shop.id } }, // Chỉ lấy các món hàng thuộc shop mình
          include: { product: true }
        }
      }
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.');
    return order;
  }
  async findOne(id: string, userId: string) {
    // 1. Kiểm tra đầu vào
    if (!id || id === 'undefined' || id === 'null') {
       throw new NotFoundException('Mã đơn hàng không hợp lệ');
    }

    // 2. Tìm đơn hàng khớp với ID (UUID) HOẶC Mã vận đơn (shippingOrderCode)
    // Và BẮT BUỘC phải thuộc về userId đang đăng nhập
    const order = await this.prisma.order.findFirst({
      where: {
        AND: [
          { userId: userId }, // Bảo mật: Chỉ chủ sở hữu mới xem được
          {
            OR: [
              { id: id }, // Tìm theo UUID chính của đơn
              { shippingOrderCode: id } // Tìm theo mã vận đơn (phòng trường hợp FE truyền mã GHN)
            ]
          }
        ]
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                images: true,
              }
            }
          }
        },
        voucher: true
      }
    });

    if (!order) {
      // Log để debug xem tại sao không tìm thấy (do sai ID hay sai User)
      this.logger.warn(`Failed to find order: ${id} for user: ${userId}`);
      throw new NotFoundException('Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.');
    }

    return order;
  }
}