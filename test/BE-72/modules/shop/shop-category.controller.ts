import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

@Controller('seller/shop-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SELLER')
export class ShopCategoryController {
  constructor(private prisma: PrismaService) {}

  // Helper để lấy Shop ID của Seller hiện tại
  private async getShopId(ownerId: string): Promise<string> {
    if (!ownerId) throw new NotFoundException('User ID not found in request');
    
    const shop = await this.prisma.shop.findFirst({ where: { ownerId } });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop.id;
  }

  @Post()
  async create(@Request() req, @Body('name') name: string) {
    const shopId = await this.getShopId(req.user.id);
    return this.prisma.shopCategory.create({
      data: { name, shopId }
    });
  }

  @Get()
  async findAll(@Request() req) {
    const shopId = await this.getShopId(req.user.id);
    return this.prisma.shopCategory.findMany({
      where: { shopId, isActive: true },
      include: { 
        _count: { select: { products: true } } // Đếm số sản phẩm trong danh mục
      }
    });
  }

  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() body: { name?: string, isActive?: boolean }) {
    const shopId = await this.getShopId(req.user.id);
    // Kiểm tra quyền sở hữu
    const category = await this.prisma.shopCategory.findFirst({ where: { id, shopId } });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    return this.prisma.shopCategory.update({
      where: { id },
      data: { ...body }
    });
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    const shopId = await this.getShopId(req.user.id);
    const category = await this.prisma.shopCategory.findFirst({ where: { id, shopId } });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    // Reset sản phẩm thuộc danh mục này về null trước khi xóa
    await this.prisma.product.updateMany({
        where: { shopCategoryId: id },
        data: { shopCategoryId: null }
    });

    return this.prisma.shopCategory.delete({ where: { id } });
  }

  // API thêm nhiều sản phẩm vào danh mục
  @Post(':id/products')
  async addProducts(@Request() req, @Param('id') id: string, @Body('productIds') productIds: string[]) {
    const shopId = await this.getShopId(req.user.id);
    // Validate category ownership
    const category = await this.prisma.shopCategory.findFirst({ where: { id, shopId } });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    // Cập nhật shopCategoryId cho các sản phẩm được chọn
    // Lưu ý: Đảm bảo sản phẩm cũng thuộc về Shop này (security)
    return this.prisma.product.updateMany({
      where: { 
        id: { in: productIds },
        shopId: shopId 
      },
      data: { shopCategoryId: id }
    });
  }
  
  // API gỡ sản phẩm khỏi danh mục
  @Delete(':id/products')
  async removeProducts(@Request() req, @Param('id') id: string, @Body('productIds') productIds: string[]) {
     const shopId = await this.getShopId(req.user.id);
     return this.prisma.product.updateMany({
        where: { 
            id: { in: productIds },
            shopId: shopId,
            shopCategoryId: id
        },
        data: { shopCategoryId: null }
     });
  }
}