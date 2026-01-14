import { Controller, Get, UseGuards, Param, Delete, Patch, Body, Query } from '@nestjs/common';
import { ProductWriteService } from '../services/product-write.service'; // Dùng Write Service
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { ProductReadService } from '../services/product-read.service';
@Controller('admin/products') // Prefix riêng cho Admin
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Chỉ Admin mới vào được
export class AdminProductController {
  constructor(private readonly productWriteService: ProductWriteService, private readonly prisma: PrismaService, private readonly productReadService: ProductReadService) {}

  // Admin cần xem danh sách full (kể cả hàng ẩn/hết hàng) để quản lý
  @Get()
  async findAll(@Query('status') status: string, @Query('page') page: string) {
     const whereCondition: any = {};
     
     // 1. Filter theo status
     if (status && status !== 'ALL') {
         whereCondition.status = status as ProductStatus;
     }

     // 2. Query DB
     // [QUAN TRỌNG] Đổi 'seller' thành 'shop' để lấy đúng tên cửa hàng
     const products = await this.prisma.product.findMany({
        where: whereCondition,
        include: { 
            shop: { select: { id: true, name: true, avatar: true } }, 
            brandRel: { select: { id: true, name: true } },
            _count: { select: { variants: true } } 
        },
        orderBy: { createdAt: 'desc' },
     });

     return products;
  }

  // 2. API Duyệt / Từ chối (Đã xóa hàm trùng lặp)
  @Patch(':id/approval')
  @Roles(Role.ADMIN)
  async approveProduct(
      @Param('id') id: string, 
      @Body() body: { status: 'ACTIVE' | 'REJECTED', reason?: string }
  ) {
      return this.productWriteService.approveProduct(id, body.status, body.reason);
  }
  
  @Get('search-for-blog')
  async searchForBlog(@Query('q') query: string) {
    if (!query) return [];
    return this.productReadService.searchProductsForAdmin(query);
  }
  
  // Admin xem chi tiết để duyệt/kiểm tra
  // Lưu ý: WriteService thường query trực tiếp DB Master, đảm bảo dữ liệu mới nhất
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Return chi tiết kèm thông tin Shop
    return this.prisma.product.findUnique({
        where: { id },
        include: { 
            shop: true,
            options: { include: { values: true } },
            variants: true,
            category: true
        }
    });
  }

  // Ví dụ: Admin xóa sản phẩm vi phạm
  /*
  @Delete(':id')
  delete(@Param('id') id: string) {
     return this.productWriteService.softDelete(id);
  }
  */
}