import { Module } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { PromotionController } from './promotion.controller'; // (Tùy chọn: Nếu bạn chưa tách controller thì bỏ dòng này)
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisModule } from '../../database/redis/redis.module';

@Module({
  imports: [
    RedisModule, // Để dùng RedisService trong PromotionService
  ],
  controllers: [
    PromotionController, // Đăng ký Controller (Nếu bạn đã tạo)
  ],
  providers: [
    PromotionService,
    PrismaService, // Cung cấp PrismaService để truy vấn DB
  ],
  exports: [
    PromotionService, // <--- BẮT BUỘC: Để OrderModule có thể import và sử dụng
  ],
})
export class PromotionModule {}