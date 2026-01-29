import { Controller, Post, Body, UseGuards, Request, Get, Param, Query } from '@nestjs/common';
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
    return this.orderService.previewOrder(req.user.id, dto);
  }

  // API đặt hàng thật
  @Post()
  async create(@Request() req, @Body() dto: CreateOrderDto) {
    // Hứng kết quả từ Service (Lúc này là { order, paymentUrl })
    const result = await this.orderService.createOrder(req.user.id, dto);

    // Kiểm tra cấu trúc để tránh lỗi (đề phòng service cũ trả về order trực tiếp)
    const order = result.order || result; 
    const paymentUrl = result.paymentUrl || null;

    return {
      success: true,
      message: 'Đặt hàng thành công',
      orderId: order.id,
      paymentUrl: paymentUrl, // <--- THÊM DÒNG NÀY thì Frontend mới nhận được Link
    };
  }

  @Get()
  async findAll(@Request() req, @Query('status') status?: string) {
    // Nếu status là undefined hoặc 'all', truyền null vào service để lấy tất cả
    const filterStatus = (status === 'all' || !status) ? undefined : status.toUpperCase();
    return this.orderService.getUserOrders(req.user.id, filterStatus);
  }

  // API lấy chi tiết đơn hàng (Frontend gọi tại trang Payment Success)
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.orderService.findOne(id, req.user.id);
  }
}