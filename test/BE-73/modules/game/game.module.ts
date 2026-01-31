import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GachaService } from './gacha.service';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../database/redis/redis.module';
import { PointModule } from '../point/point.module'; // Import PointModule vì GachaService cần gọi PointService để cộng điểm

@Module({
  imports: [
    DatabaseModule, 
    RedisModule,
    PointModule // <-- Quan trọng: Để GachaService dùng được PointService
  ],
  controllers: [GameController],
  providers: [GachaService],
  exports: [GachaService], // <--- BẮT BUỘC PHẢI CÓ DÒNG NÀY
})
export class GameModule {}