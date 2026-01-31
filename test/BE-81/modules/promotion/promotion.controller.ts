import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PromotionService } from "./promotion.service";
import { JwtAuthGuard } from "../auth/guards/jwt.guard"; // Kiểm tra lại path nếu báo đỏ
import { RolesGuard } from "../../common/guards/roles.guard";
import { Role } from "@prisma/client"; // Role là Enum (Value) -> Giữ nguyên
import type { User } from "@prisma/client"; // <--- [FIX] Thêm 'type' vào đây
import { Roles } from "../../common/decorators/roles.decorator";
import { User as UserDecorator } from "../../common/decorators/user.decorator";
import { CreateVoucherDto } from "./dto/create-voucher.dto"; // Đảm bảo bạn đã tạo file này
import { Public } from "src/common/decorators/public.decorator";

// Định nghĩa nhanh DTO nếu chưa có file riêng (hoặc bạn có thể tách ra file)
export class CalculateCartDto {
    total: number;
    voucherCode?: string;
    items?: any[];
}

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  // SELLER: Tạo voucher
  @Post('seller/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async createVoucher(@Body() dto: CreateVoucherDto, @UserDecorator() user: User) {
    // Lưu ý: User lấy từ JWT có thể không full field.
    // Nếu user.id không tồn tại trong type User của Prisma (do strict mode), 
    // bạn có thể ép kiểu: (user as any).id hoặc đảm bảo decorator trả về đúng.
    return this.promotionService.createShopVoucher(user.id, dto);
  }

  @Get('public/system-vouchers')
  @Public()
  async getPublicSystemVouchers() {
    return this.promotionService.getPublicSystemVouchers();
  }

  // BUYER: Giật voucher (High CCU)
  @Post(':code/claim')
  @UseGuards(JwtAuthGuard)
  async claimVoucher(@Param('code') code: string, @UserDecorator() user: User) {
    return this.promotionService.claimVoucher(user.id, code);
  }

  // BUYER/SYSTEM: Tính toán giá giỏ hàng (Dry Run)
  @Post('calculate')
  @UseGuards(JwtAuthGuard) 
  async calculateCart(@Body() dto: CalculateCartDto) {
    return this.promotionService.calculateDiscount(dto);
  }

  @Get('seller')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  async getSellerVouchers(@UserDecorator() user: User) {
    return this.promotionService.getShopVouchers(user.id);
  }

  // Cho Buyer xem ví
  @Get('my-vouchers')
  @UseGuards(JwtAuthGuard)
  async getMyVouchers(@UserDecorator() user: User) {
    return this.promotionService.getMyVouchers(user.id);
  }

  // 1. Admin tạo Voucher sàn
  @Post('admin/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createSystemVoucher(@Body() dto: CreateVoucherDto) {
    return this.promotionService.createSystemVoucher(dto);
  }

  

  // 2. Admin xem danh sách Voucher sàn (Global)
  @Get('admin/system-vouchers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getSystemVouchers() {
    return this.promotionService.getSystemVouchers();
  }

  // 3. Admin quản lý toàn bộ Voucher (cả của Shop)
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getAllVouchers(@Query('scope') scope?: string, @Query('search') search?: string) {
    // Convert string sang Enum nếu cần
    const voucherScope = scope ? (scope as any) : undefined;
    return this.promotionService.getAllVouchers({ scope: voucherScope, search });
  }
}