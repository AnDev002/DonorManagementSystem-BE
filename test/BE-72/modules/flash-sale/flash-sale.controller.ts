// Backend-2.1.0/modules/flash-sale/flash-sale.controller.ts
import { 
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, 
  BadRequestException
} from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import { CreateFlashSaleSessionDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleSessionDto } from './dto/update-flash-sale.dto';
import { RegisterFlashSaleDto } from './dto/register-flash-sale.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from 'src/common/decorators/user.decorator';
import { ShopService } from '../shop/shop.service';
import { Public } from 'src/common/decorators/public.decorator';

// --- CONTROLLER 1: Dành cho ADMIN ---
@Controller('admin/flash-sale')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) 
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Post('sessions')
  create(@Body() createDto: CreateFlashSaleSessionDto) {
    return this.flashSaleService.createSession(createDto);
  }

  @Get('sessions')
  findAll(@Query('date') date?: string) {
    return this.flashSaleService.findAll(date);
  }

  @Patch('sessions/:id')
  update(@Param('id') id: string, @Body() updateDto: UpdateFlashSaleSessionDto) {
    return this.flashSaleService.update(id, updateDto);
  }

  @Delete('sessions/:id')
  remove(@Param('id') id: string) {
    return this.flashSaleService.remove(id);
  }
}

// --- CONTROLLER 2: Dành cho SELLER (Thêm mới class này) ---
@Controller('seller/flash-sale') // Đường dẫn bắt đầu bằng seller/...
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SELLER) // Chỉ cho phép Seller truy cập
export class SellerFlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService, private readonly shopService: ShopService) {}

  @Get('sessions')
  getAvailableSessions() {
    return this.flashSaleService.findAvailableSessionsForSeller();
  }

  @Get('sessions/:sessionId/products')
  async getRegisteredProducts(@User() user: any, @Param('sessionId') sessionId: string) {
    const shop = await this.shopService.getShopByOwnerId(user.id);
    if (!shop) throw new BadRequestException('Shop not found');
    
    return this.flashSaleService.getRegisteredProducts(shop.id, sessionId);
  }

  
  @Post('register')
  async registerProducts(@User() user: any, @Body() dto: RegisterFlashSaleDto) {
    // [FIX QUAN TRỌNG]: Lấy Shop ID từ User ID
    const shop = await this.shopService.getShopByOwnerId(user.id);
    
    if (!shop) {
        throw new BadRequestException('Tài khoản này chưa tạo Cửa hàng!');
    }

    // Truyền shop.id (UUID của Shop) thay vì user.id
    return this.flashSaleService.registerProducts(shop.id, dto);
  }
}

@Controller('store/flash-sale') // Đường dẫn store/... thường dùng cho public
export class StoreFlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Public() // Cho phép truy cập không cần token
  @Get('current')
  getCurrentSession() {
    return this.flashSaleService.getCurrentFlashSaleForBuyer();
  }
}