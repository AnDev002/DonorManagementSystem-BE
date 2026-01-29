// type: uploaded file
// fileName: Back-end/modules/product/controllers/admin-product.controller.ts

import { Controller, Get, UseGuards, Param, Delete, Patch, Body, Query, Header } from '@nestjs/common'; // [GENIUS] Thêm Header
import { ProductWriteService } from '../services/product-write.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { ProductReadService } from '../services/product-read.service';
import { CategoryService } from '../../category/category.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProductController {
  constructor(private readonly productWriteService: ProductWriteService, private readonly prisma: PrismaService, private readonly productReadService: ProductReadService, private readonly categoryService: CategoryService) {}

  // Admin cần xem danh sách full (kể cả hàng ẩn/hết hàng) để quản lý
  @Get()
  // [GENIUS FIX] Thêm Header để chặn Cache tuyệt đối. Admin cần dữ liệu tươi 100%.
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async findAll(
  @Query('status') status: string, 
  @Query('page') page: string,
  @Query('limit') limit: string,
  @Query('search') search: string,
  @Query('categoryId') categoryId: string
) {
   const whereCondition: any = {};
   const pageNum = Number(page) || 1;
   const limitNum = Number(limit) || 20;
   const skip = (pageNum - 1) * limitNum;

   // 1. Filter theo status
   if (status && status !== 'ALL') {
       whereCondition.status = status as ProductStatus;
   }

   // 2. Filter theo Search
   if (search) {
       whereCondition.OR = [
           { name: { contains: search } }, 
           { slug: { contains: search } }, 
           { variants: { some: { sku: { contains: search } } } } 
       ];
   }

   // 3. Filter theo Category
   if (categoryId) {
      const allCategoryIds = await this.categoryService.getAllDescendantIds(categoryId);
      whereCondition.categoryId = { in: allCategoryIds };
   }

   // 4. Query DB & Pagination
   // [OPTIMIZATION] Dùng $transaction để đảm bảo tính nhất quán và performance tốt hơn chút
   const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
          where: whereCondition,
          include: { 
              shop: { select: { id: true, name: true, avatar: true } }, 
              brandRel: { select: { id: true, name: true } },
              category: { select: { id: true, name: true } },
              _count: { select: { variants: true } } 
          },
          orderBy: { createdAt: 'desc' }, // Mới nhất lên đầu để admin dễ thấy cái vừa sửa
          take: limitNum,
          skip: skip
      }),
      this.prisma.product.count({ where: whereCondition })
   ]);

   return {
       data: products,
       meta: {
           total,
           page: pageNum,
           totalPages: Math.ceil(total / limitNum)
       }
   };
}

  @Patch('bulk-approval')
  @Roles(Role.ADMIN)
  async bulkApprove(
    @Body() body: { ids: string[], status: 'ACTIVE' | 'REJECTED', reason?: string }
  ) {
    return this.productWriteService.bulkApproveProducts(body.ids, body.status, body.reason);
  }

  // 2. API Duyệt / Từ chối
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
  
  @Get(':id')
  // [GENIUS FIX] Chi tiết cũng không nên cache khi admin đang edit/duyệt
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async findOne(@Param('id') id: string) {
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
}