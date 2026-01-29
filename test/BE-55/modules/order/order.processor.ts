import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { TrackingService } from '../tracking/tracking.service';
import { EventType } from '../tracking/dto/track-event.dto';

@Processor('order_queue', {
  // [TỐI ƯU]: Vì đã check stock bằng Redis (Atomic), ta có thể tăng concurrency 
  // để xử lý việc ghi DB nhanh hơn mà không sợ Race Condition.
  concurrency: 5 
})
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly trackingService: TrackingService
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { userId, orderData, trackingId } = job.data;
    
    const acquiredItems: { productId: string, quantity: number }[] = [];

    try {
        for (const item of orderData.items) {
            const acquired = await this.cartService.acquireStock(item.productId, item.quantity);
            
            if (acquired) {
                acquiredItems.push(item); // Ghi nhận đã trừ thành công
            } else {
                throw new Error(`Sản phẩm ${item.productId} hết hàng.`);
            }
        }

        await this.prisma.$transaction(async (tx) => {
            const productIds = orderData.items.map(i => i.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, price: true, stock: true }
            });

            const productMap = new Map(products.map(p => [p.id, p]));
            let totalAmount = 0;

            const orderItemsData: { productId: string; quantity: number; price: number }[] = []; 

            for (const item of orderData.items) {
                const product = productMap.get(item.productId);
                if (!product) throw new Error(`Sản phẩm ${item.productId} không tồn tại trong DB`);

                const itemPrice = Number(product.price);
                const itemTotal = itemPrice * item.quantity;
                totalAmount += itemTotal;

                // Giờ push vào sẽ không bị lỗi nữa
                orderItemsData.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: itemPrice 
                });

                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });
            }

            await tx.order.create({
                data: {
                    id: trackingId,
                    userId: userId,
                    totalAmount: totalAmount,
                    status: 'PENDING',
                    paymentMethod: orderData.paymentMethod,
                    items: {
                        create: orderItemsData
                    }
                }
            });
        });

        // 3. Xử lý sau khi thành công
        if (!orderData.isBuyNow) {
            await this.cartService.clearCart(userId);
        }

        await this.trackingService.trackEvent(userId, 'worker', {
            type: EventType.PURCHASE,
            targetId: trackingId,
            metadata: { revenue: orderData.totalAmount }
        });

        this.logger.log(`✅ Order [${trackingId}] created successfully.`);
        return { success: true, orderId: trackingId };

    } catch (error) {
        this.logger.error(`❌ Order Failed [${trackingId}]: ${error.message}`);

        if (acquiredItems.length > 0) {
            this.logger.warn(`🔄 Rolling back Redis stock for ${acquiredItems.length} items...`);
            await Promise.all(
                acquiredItems.map(item => 
                    this.cartService.releaseStock(item.productId, item.quantity)
                )
            );
        }
        throw error;
    }
  }
}