import { Controller, Post, UseGuards } from '@nestjs/common';
import { GachaService } from './gacha.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GameController {
  constructor(private readonly gachaService: GachaService) {}

  @Post('gacha/spin')
  async spin(@User() user) {
    // Sửa req.user.id thành user.id cho thống nhất
    return this.gachaService.spin(user.id);
  }
}