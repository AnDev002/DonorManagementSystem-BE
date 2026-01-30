import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PointService } from './point.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointController {
  constructor(
    private readonly pointService: PointService,
  ) {}

  // API: GET /points/me
  @Get('me')
  async getMyPointInfo(@User() user) {
    return this.pointService.getMyPointInfo(user.id);
  }

  // API: GET /points/history
  @Get('history')
  async getHistory(@User() user) {
    return this.pointService.getHistory(user.id);
  }

  // API: POST /points/check-in
  @Post('check-in')
  async checkIn(@User() user) {
    // [FIX LỖI TẠI ĐÂY]: Gọi đúng hàm dailyCheckIn đã định nghĩa trong service
    return this.pointService.dailyCheckIn(user.id);
  }

  @Post('transfer/init')
  async initiateTransfer(
    @User() user,
    @Body() body: { receiverId: string; amount: number }
  ) {
    return this.pointService.initiateTransfer(user.id, body.receiverId, body.amount);
  }

  @Post('transfer/confirm')
  async confirmTransfer(
    @User() user,
    @Body() body: { otp: string }
  ) {
    return this.pointService.confirmTransfer(user.id, body.otp);
  }
}