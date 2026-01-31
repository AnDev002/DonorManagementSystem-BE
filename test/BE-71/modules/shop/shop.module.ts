import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopCategoryController } from './shop-category.controller'; // [1] Import Controller này
import { ShopService } from './shop.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    ShopController, 
    ShopCategoryController // [2] Đăng ký vào mảng controllers
  ],
  providers: [ShopService],
  exports: [ShopService]
})
export class ShopModule {}