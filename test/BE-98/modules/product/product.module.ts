import { Module } from '@nestjs/common';
import { ProductReadService } from './services/product-read.service';
import { ProductWriteService } from './services/product-write.service';
import { ProductCacheService } from './services/product-cache.service';
import { SellerProductController } from './controllers/seller-product.controller';
import { StoreProductController } from './controllers/store-product.controller';
import { AdminProductController } from './controllers/admin-product.controller'; // Import mới
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [
    CategoryModule, // [FIX] Thêm dòng này để ProductReadService dùng được CategoryService
  ],
  controllers: [
    StoreProductController,  // Cho Khách hàng (Buyer)
    SellerProductController, // Cho Người bán (Seller)
    AdminProductController,  // Cho Quản trị viên (Admin)
  ],
  providers: [
    ProductReadService,
    ProductWriteService,
    ProductCacheService
  ],
  exports: [
    ProductReadService,
    ProductWriteService,
    ProductCacheService
  ],
})
export class ProductModule {}