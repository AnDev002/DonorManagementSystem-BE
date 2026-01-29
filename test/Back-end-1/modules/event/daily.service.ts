import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PointService } from '../point/point.service';
import { RedisService } from '../../database/redis/redis.service';
import { PointType } from '@prisma/client';

@Injectable()
export class DailyService {
  // Cấu hình phần thưởng 7 ngày
  private readonly REWARDS = [100, 150, 200, 250, 300, 400, 1000]; // Ngày 7 nổ hũ 1000

  constructor(
    private pointService: PointService,
    private redisService: RedisService
  ) {}

  async checkIn(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const redisKey = `checkin:${userId}:${today}`;
    const streakKey = `streak:${userId}`;

    // 1. Check đã điểm danh hôm nay chưa
    const hasCheckedInCache = await this.redisService.get(redisKey);
    if (hasCheckedInCache) {
        throw new BadRequestException('Hôm nay bạn đã nhận thưởng rồi!');
    }

    // 2. Tính toán Streak (Chuỗi ngày)
    let currentStreak = 0;
    const lastCheckInDate = await this.redisService.get(`last_checkin_date:${userId}`);
    
    if (lastCheckInDate) {
        const lastDate = new Date(lastCheckInDate);
        const currDate = new Date(today);
        const diffTime = Math.abs(currDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
            // Nếu hôm qua đã điểm danh -> Tăng streak
            const savedStreak = await this.redisService.get(streakKey);
            currentStreak = savedStreak ? parseInt(savedStreak) : 0;
        } else if (diffDays > 1) {
            // Nếu bỏ lỡ 1 ngày -> Reset về 0
            currentStreak = 0;
        }
        // Nếu diffDays == 0 là cùng ngày (đã chặn ở trên rồi)
    }

    // Đảm bảo streak chạy từ 0 đến 6 (tương ứng ngày 1 -> 7)
    if (currentStreak >= 7) currentStreak = 0; // Reset chu kỳ sau 7 ngày

    const rewardPoints = this.REWARDS[currentStreak];
    const dayLabel = currentStreak + 1; // Ngày hiển thị (1-7)

    const refId = `DAILY_${userId}_${today}`;
    
    try {
        const result = await this.pointService.processTransaction(
            userId,
            rewardPoints,
            PointType.EARN_DAILY,
            refId,
            `Điểm danh Ngày ${dayLabel}`
        );
        
        // 3. Lưu trạng thái
        await this.redisService.set(redisKey, '1', 86400); // Đánh dấu hôm nay xong
        await this.redisService.set(`last_checkin_date:${userId}`, today, 86400 * 2); // Lưu ngày checkin cuối
        await this.redisService.set(streakKey, (currentStreak + 1).toString(), 86400 * 2); // Lưu streak mới

        return { 
            message: `Điểm danh Ngày ${dayLabel} thành công!`,
            reward: rewardPoints,
            streak: currentStreak + 1,
            currentPoints: result.newBalance 
        };

    } catch (e) {
        if (e instanceof ConflictException) { 
             await this.redisService.set(redisKey, '1', 86400);
             throw new BadRequestException('Hôm nay bạn đã điểm danh rồi!');
        }
        throw e;
    }
  }

  async getDailyStatus(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const checkinKey = `checkin:${userId}:${today}`;
    const streakKey = `streak:${userId}`;

    const [hasCheckedIn, streakStr] = await Promise.all([
        this.redisService.get(checkinKey),
        this.redisService.get(streakKey)
    ]);

    const currentStreak = streakStr ? parseInt(streakStr) : 0;

    return {
        isCheckedInToday: !!hasCheckedIn,
        currentStreak: currentStreak // Frontend cần cái này để highlight ô quà
    };
  }

  async resetDailyTest(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const checkinKey = `checkin:${userId}:${today}`;
    const gachaKey = `gacha:${userId}:${today}`;
    
    // Xóa key trong Redis
    await this.redisService.del(checkinKey);
    await this.redisService.del(gachaKey);
    
    // (Tùy chọn) Nếu muốn reset luôn chuỗi streak về 0 để test ngày 1
    // await this.redisService.del(`streak:${userId}`);
    // await this.redisService.del(`last_checkin_date:${userId}`);

    return { message: 'Đã reset! Bạn có thể điểm danh lại.' };
  }
}