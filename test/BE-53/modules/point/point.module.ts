import { Module } from '@nestjs/common';
import { PointService } from './point.service';
import { PointController } from './point.controller';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../database/redis/redis.module'; // Thêm nếu chưa có
//import { MailerModule } from '@nestjs-modules/mailer'; // Nếu lỗi injection mailer

@Module({
  imports: [
    DatabaseModule, 
    RedisModule, // Để dùng RedisService
    // MailerModule // [LƯU Ý]: Nếu MailerModule được set isGlobal: true ở AppModule thì không cần dòng này. 
    // Nếu chưa global, bạn phải import MailerModule ở đây.
  ],
  controllers: [PointController],
  providers: [PointService],
  exports: [PointService],
})
export class PointModule {}