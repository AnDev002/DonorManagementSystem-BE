import { Controller, Get, Param, Query, Request, Headers, UseGuards, Post, ParseUUIDPipe, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ProductReadService } from '../services/product-read.service';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Controller('store/products') 
export class StoreProductController {
  constructor(private readonly productReadService: ProductReadService, private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @UseGuards(JwtAuthGuard)
  async getProducts(
    @Request() req,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('categorySlug') categorySlug: string,
    @Query('minPrice') minPrice: number,
    @Query('maxPrice') maxPrice: number,
    @Query('rating') rating: number,
    @Query('sort') sort: string,
    @Query('tag') tag: string,
    @Headers('x-device-id') deviceId: string
  ) {
    // Logic vẫn dùng ReadService xịn xò (có Redis)
    if (search === 'recommendation') {
        const userId = req.user?.userId || (deviceId ? `guest:${deviceId}` : null);
        if (userId) {
            return this.productReadService.getPersonalizedFeed(userId, Number(page) || 1, Number(limit) || 20);
        }
    }

    // 2. Logic Filter đầy đủ
    return this.productReadService.findAllPublic({ 
      page: Number(page), 
      limit: Number(limit), 
      search,
      categorySlug, // Pass slug xuống service
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      rating: rating ? Number(rating) : undefined,
      sort,
      tag,
    });
  }

  @Get(':id')
  @Public()
  getProductDetail(@Param('id') id: string) {
    console.log("Backend received ID/Slug:", id); // <--- Thêm dòng này
    return this.productReadService.findOnePublic(id);
  }

  @Post('sync-search-index')
  // @Public() // Hoặc bảo vệ bằng Admin Guard
  async syncSearchIndex() {
    return this.productReadService.syncAllProductsToRedis();
  }

  @Get(':id/related')
  @Public()
  getRelated(@Param('id') id: string) {
    return this.productReadService.findRelated(id);
  }

  @Get(':id/more-from-shop')
  @Public()
  getMoreFromShop(@Param('id') id: string) {
    return this.productReadService.findMoreFromShop(id);
  }

  // 2. Endpoint cho "Thường được mua kèm"
  @Get(':id/bought-together')
  @Public()
  async getBoughtTogether(@Param('id') id: string) {
      const relations = await this.prisma.productCrossSell.findMany({
          where: { productId: id },
          include: {
              relatedProduct: { 
                  include: {
                      // [FIX] Include values của options
                      options: { 
                          include: { values: true },
                          orderBy: { position: 'asc' }
                      },
                      variants: true
                  }
              }
          },
          take: 6 
      });

      return relations.map(r => {
          const p = r.relatedProduct;
          return {
              ...p,
              id: p.id,
              name: p.name,
              // [FIX] Convert Decimal sang Number
              price: Number(p.price),
              stock: Number(p.stock),
              
              // [FIX] Xử lý ảnh an toàn (trả về mảng string url)
              images: (p.images as any)?.map((i: any) => typeof i === 'string' ? i : i.url) || [], 
              slug: p.slug,

              // [FIX] Map options chuẩn cho BoughtTogether Frontend
              options: p.options.map(opt => ({
                  name: opt.name,
                  // Frontend đang map: opt.values.map(v => v.value) -> Cần trả về object có key value
                  values: opt.values.map(v => ({ 
                      value: v.value,
                      image: v.image // Kèm thêm ảnh nếu có
                  }))
              })),

              variants: p.variants.map(v => ({
                  ...v,
                  price: Number(v.price),
                  stock: Number(v.stock)
              }))
          };
      });
  }

  @Get(':id/reviews')
  async getProductReviews(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('rating') rating?: number, // Filter theo sao (1-5)
  ) {
    const skip = (page - 1) * limit;
    
    // Xây dựng điều kiện lọc
    const whereCondition: any = { productId };
    if (rating) {
      whereCondition.rating = Number(rating);
    }

    // Chạy song song: Lấy list review + Lấy thống kê phân bổ sao
    const [reviews, total, starCounts] = await Promise.all([
      // 1. Lấy danh sách review
      this.prisma.productReview.findMany({
        where: whereCondition,
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, avatar: true } // Chỉ lấy tên và avatar
          },
          // order: { select: { items: true } } // Nếu muốn hiện size/màu đã mua
        }
      }),

      // 2. Đếm tổng số review (theo filter hiện tại)
      this.prisma.productReview.count({ where: whereCondition }),

      // 3. Thống kê số lượng từng loại sao (All time) để hiện UI filter
      this.prisma.productReview.groupBy({
        by: ['rating'],
        where: { productId },
        _count: { rating: true },
      }),
    ]);

    // Format lại distribution
    const distribution = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    starCounts.forEach(item => {
      distribution[item.rating] = item._count.rating;
    });

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      distribution // Trả về { 5: 10, 4: 2, ... }
    };
  }
}