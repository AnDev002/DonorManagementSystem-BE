import { Controller, UseGuards, Request, Query, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { OrderService } from '../order.service';

@Controller('user-orders')
@UseGuards(JwtAuthGuard)
export class UserOrderController {
  constructor(private readonly orderService: OrderService) {}
  @Get()
  async findAll(@Request() req, @Query('status') status?: string) {
    // Nếu status là undefined hoặc 'all', truyền null vào service để lấy tất cả
    const filterStatus = (status === 'all' || !status) ? undefined : status.toUpperCase();
    return this.orderService.getUserOrders(req.user.id, filterStatus);
  }
}