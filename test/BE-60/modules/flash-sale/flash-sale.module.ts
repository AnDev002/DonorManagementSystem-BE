// Backend-2.1.0/modules/flash-sale/flash-sale.module.ts
import { Module } from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
// Import cả 2 Controller
import { FlashSaleController, SellerFlashSaleController, StoreFlashSaleController } from './flash-sale.controller';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ShopModule } from '../shop/shop.module';

@Module({
  // Đăng ký cả 2 controller vào mảng controllers
  imports: [ShopModule],
  controllers: [FlashSaleController, SellerFlashSaleController, StoreFlashSaleController], 
  providers: [FlashSaleService, PrismaService],
})
export class FlashSaleModule {}