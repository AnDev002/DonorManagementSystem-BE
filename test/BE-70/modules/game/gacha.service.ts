import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PointService } from '../../modules/point/point.service';
import { RedisService } from '../../database/redis/redis.service';
import { PointType } from '@prisma/client';

@Injectable()
export class GachaService {
  constructor(
    private prisma: PrismaService,
    private pointService: PointService,
    private redis: RedisService,
  ) {}

  // --- [THÊM MỚI] Hàm này để Controller lấy trạng thái ---
  async getTodaySpinStatus(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `gacha:${userId}:${today}`;
    const hasSpun = await this.redis.get(dailyKey);
    
    return { hasSpun: !!hasSpun };
  }
  // -------------------------------------------------------

  async spin(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `gacha:${userId}:${today}`; 

    // 1. Check xem đã quay hôm nay chưa
    const hasSpun = await this.redis.get(dailyKey);
    if (hasSpun) {
      throw new BadRequestException('Hôm nay bạn đã hết lượt quay miễn phí!');
    }

    // 2. Lock để tránh race condition
    const lockKey = `lock:gacha:${userId}`;
    const acquired = await this.redis.setNX(lockKey, '1', 5); 
    if (!acquired) throw new BadRequestException('Đang xử lý...');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const rand = Math.random() * 100;
        let reward = 0;
        let message = 'Chúc bạn may mắn lần sau';
        let won = false;

        if (rand < 50) { 
           // Trượt
        } else if (rand < 90) { 
           reward = 100; message = 'Trúng 100 xu'; won = true;
        } else {
           reward = 1000; message = 'NỔ HŨ 1000 xu'; won = true;
        }

        if (won && reward > 0) {
           await this.pointService.addPoints(
             userId, 
             reward, 
             PointType.EARN_GAME || 'EARN_GAME', 
             `GACHA_${Date.now()}`, 
             `Gacha: ${message}`, 
             tx
           );
        }

        // Đánh dấu đã quay
        await this.redis.set(dailyKey, '1', 86400);

        return { won, reward, message };
      });
    } finally {
      await this.redis.del(lockKey);
    }
  }
}