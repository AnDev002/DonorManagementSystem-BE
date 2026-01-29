import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { DailyService } from './daily.service';
import { GachaService } from '../game/gacha.service'; 
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator'; 

@Controller('events')
@UseGuards(JwtAuthGuard) 
export class EventController {
  constructor(
    private readonly dailyService: DailyService,
    private readonly gachaService: GachaService,
  ) {}

  @Post('daily-checkin')
  async dailyCheckIn(@User() user) {
    return this.dailyService.checkIn(user.id);
  }

  @Get('status')
  async getStatus(@User() user) {
    // 1. Lấy trạng thái checkin từ DailyService
    const dailyStatus = await this.dailyService.getDailyStatus(user.id);
    
    // 2. Lấy trạng thái Gacha từ GachaService (đã fix lỗi TS2339)
    const gachaStatus = await this.gachaService.getTodaySpinStatus(user.id);

    // 3. Trả về format đúng key mà Frontend cần
    return {
      // Sửa lỗi TS2339: checkInStatus.isCheckedIn -> dailyStatus.isCheckedInToday
      isCheckedInToday: dailyStatus.isCheckedInToday, 
      hasSpunToday: gachaStatus.hasSpun,           
    };
  }

  @Post('reset-test')
  async resetTest(@User() user) {
    return this.dailyService.resetDailyTest(user.id);
  }
}