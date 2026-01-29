import { Controller, Post, Body, UseGuards, Request, Get, Param, Patch, Query, Put, BadRequestException } from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { UpdateShopProfileDto } from '../auth/dto/update-shop.dto';
// ... imports DTO

@Controller('shops')
export class ShopController {
  constructor(private shopService: ShopService) {}

  // API Đăng ký Shop (Thay thế luồng cũ)
  @UseGuards(JwtAuthGuard)
  @Post('register')
  async registerShop(@Request() req, @Body() body: any) {
    // body: { name, pickupAddress, description... }
    return this.shopService.createShop(req.user.userId, body);
  }
  @Public()
  @Get(':id/profile')
  async getShopProfile(@Param('id') id: string) {
    return this.shopService.getPublicProfile(id);
  }

  @Public()
  @Get(':id/categories')
  async getShopCategories(@Param('id') id: string) {
    return this.shopService.getShopCategories(id);
  }

  // --- API MỚI: Lấy danh sách sản phẩm của Shop (Filter, Sort, Paginate) ---
  @Public()
  @Get(':id/products')
  async getShopProducts(@Param('id') id: string, @Query() query: any) {
    return this.shopService.getShopProducts(id, query);
  }

  // 2. Lấy danh sách Voucher của Shop (cho Product Detail Page)
  @Public()
  @Get(':id/vouchers')
  async getShopVouchers(@Param('id') id: string) {
    return this.shopService.getShopVouchers(id);
  }
  // API Seller tự xem/sửa Shop mình
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyShop(@Request() req) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
        throw new BadRequestException("User ID không hợp lệ");
    }
    return this.shopService.getShopByOwnerId(req.user.id); 
  }

  // API Public xem Shop
  @Get(':slug')
  async getShopPublic(@Param('slug') slug: string) {
    return this.shopService.getShopBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/decoration')
  async getMyDecoration(@Request() req) {
    const shop = await this.shopService.getShopByOwnerId(req.user.id);
    return { decoration: shop.decoration || [] };
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/decoration')
  async updateDecoration(@Request() req, @Body() body: { decoration: any }) {
    const userId = req.user.userId || req.user.id; // [FIX] Đồng bộ lấy ID
    if (!userId) {
        throw new BadRequestException("Không tìm thấy User ID hợp lệ");
    }
    return this.shopService.updateDecoration(req.user.id, body.decoration);
  }

  @Get(':id/custom-categories')
  @Public() // Đảm bảo decorator Public hoạt động để khách không cần login cũng xem được
  async getShopCustomCategories(@Param('id') id: string) {
    return this.shopService.getShopCustomCategories(id);
  }

  @Get(':id/custom-categories')
  @Public() // Đảm bảo decorator này tồn tại để khách truy cập không cần login
  async getCustomCategories(@Param('id') shopId: string) {
    return this.shopService.getShopCustomCategories(shopId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/profile')
  async updateMyShopProfile(@Request() req, @Body() body: UpdateShopProfileDto) {
    const userId = req.user.userId || req.user.id;
    return this.shopService.updateShopProfile(userId, body);
  }
}