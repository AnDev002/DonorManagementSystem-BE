// BE-1.0/modules/order/order.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './order.service'; // <--- THÊM
import { OrderProcessor } from './order.processor';
import { CartModule } from '../cart/cart.module'; // Check lại path tương đối
import { TrackingModule } from '../tracking/tracking.module'; 
import { PromotionModule } from '../promotion/promotion.module'; // <--- THÊM IMPORT
import { PointModule } from '../point/point.module';
import { DatabaseModule } from 'src/database/database.module';
import { AdminOrderController } from './controllers/admin-order.controller';
import { GhnModule } from '../ghn/ghn.module';
import { PaymentModule } from '../payment/payment.module';
import { ReviewService } from './review.service';
@Module({
  imports: [
    DatabaseModule,
    CartModule, 
    TrackingModule,
    PromotionModule,
    PointModule,
    GhnModule,
    PaymentModule,
    BullModule.registerQueue({
      name: 'order_queue',
    }),
  ], 
  controllers: [OrderController, AdminOrderController],
  providers: [
    OrderService,  
    ReviewService,
    OrderProcessor,
  ],
  exports: [OrderService] 
})
export class OrderModule {}