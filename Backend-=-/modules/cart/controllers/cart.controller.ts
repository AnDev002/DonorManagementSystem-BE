import { 
  Controller, Get, Post, Patch, Delete, 
  Body, Param, Request, UseGuards 
} from '@nestjs/common';
import { CartService } from '../cart.service';
import { AddToCartDto } from '../dto/add-to-cart.dto';
import { UpdateCartDto } from '../dto/update-cart.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';

@Controller('store/cart') 
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Request() req) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post()
  addToCart(@Request() req, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.userId, dto);
  }

  // --- SỬA ĐOẠN NÀY ---
  @Patch(':itemId') // itemId ở đây thực chất là productId trong Redis Hash
  updateQuantity(
    @Request() req,
    @Param('itemId') productId: string, // Đổi tên biến cho rõ nghĩa
    @Body() dto: UpdateCartDto,
  ) {
    // Gọi đúng tên hàm mới là updateQuantity
    return this.cartService.updateQuantity(req.user.userId, productId, dto.quantity);
  }
  // --------------------

  @Delete(':itemId')
  removeItem(@Request() req, @Param('itemId') productId: string) {
    // Sửa luôn chỗ này cho đồng bộ (nếu service xoá cũng đổi tên)
    return this.cartService.removeItem(req.user.userId, productId);
  }
}