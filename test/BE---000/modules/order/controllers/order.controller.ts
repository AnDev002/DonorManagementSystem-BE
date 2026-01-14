import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { OrderService } from '../order.service';
import { CreateOrderDto } from '../dto/create-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // API tính giá trước khi đặt (Frontend gọi khi user thay đổi voucher, shipping...)
  @Post('preview')
  async preview(@Request() req, @Body() dto: CreateOrderDto) {
    return this.orderService.previewOrder(req.user.userId, dto);
  }

  // API đặt hàng thật
  @Post()
  async create(@Request() req, @Body() dto: CreateOrderDto) {
    const order = await this.orderService.createOrder(req.user.userId, dto);
    return {
      success: true,
      message: 'Đặt hàng thành công',
      orderId: order.id,
      // Nếu thanh toán online (Momo/ZaloPay), trả về paymentUrl tại đây
    };
  }
}