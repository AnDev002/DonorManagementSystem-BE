import { Module } from '@nestjs/common';
import { DailyService } from './daily.service';
import { EventController } from './event.controller';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../database/redis/redis.module';
import { PointModule } from '../point/point.module';
import { GameModule } from '../game/game.module'; // <--- Đảm bảo đã import

@Module({
  imports: [
    DatabaseModule, 
    RedisModule,
    PointModule, 
    GameModule   // <--- Đảm bảo dòng này có
  ],
  controllers: [EventController],
  providers: [DailyService], 
  exports: [DailyService]
})
export class EventModule {}