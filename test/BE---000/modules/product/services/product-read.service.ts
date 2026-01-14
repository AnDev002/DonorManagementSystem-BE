import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../database/redis/redis.constants';
import { ProductCacheService } from './product-cache.service';
import { CategoryService } from '../../category/category.service'; // [MỚI] Import CategoryService
import { Prisma } from '@prisma/client';

interface FindAllPublicDto {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  categorySlug?: string;
  brandId?: number;
  minPrice?: number; // [MỚI]
  maxPrice?: number; // [MỚI]
  rating?: number;   // [MỚI]
  sort?: string;     // [MỚI]
  tag?: string; // [MỚI]
}

@Injectable()
export class ProductReadService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly productCache: ProductCacheService,
    private readonly categoryService: CategoryService, // [MỚI] Inject CategoryService
  ) {}

  // 1. Lấy Feed cá nhân hóa (Logic phức tạp + Redis)
  async getPersonalizedFeed(userId: string, page: number, limit: number) {
    const trackingKey = `user:affinity:${userId}`;
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    // A. Thử lấy ID từ Redis Score (User Affinity)
    let productIds = await this.redis.zrevrange(trackingKey, start, stop);

    // B. Fallback 1: Nếu không có dữ liệu cá nhân -> Lấy Trending từ Redis
    if (productIds.length === 0) {
      productIds = await this.redis.zrevrange('global:trending', start, stop);
    }

    // C. Hydrate dữ liệu từ Cache Service
    const products = await this.productCache.getProductsByIds(productIds);
    
    // D. Filter Active: Chỉ lấy sản phẩm ACTIVE (Đã duyệt)
    let activeProducts = products.filter(p => p.status === 'ACTIVE');

    // --- [LOGIC MỚI - GIẢI PHÁP BỀN VỮNG] ---
    // Nếu số lượng lấy từ Redis KHÔNG ĐỦ limit -> Gọi Database bù vào.
    if (activeProducts.length < limit) {
        const missingCount = limit - activeProducts.length;
        
        // Gọi hàm findAllPublic để lấy sản phẩm mới nhất từ DB
        const dbFallback = await this.findAllPublic({ 
            page: 1, 
            limit: missingCount 
        });

        // Merge dữ liệu: Cache + DB (loại bỏ trùng lặp)
        const currentIds = new Set(activeProducts.map(p => p.id));
        const newItems = dbFallback.data.filter(p => !currentIds.has(p.id));
        
        activeProducts = [...activeProducts, ...newItems];
    }

    return {
      data: activeProducts,
      meta: { page, limit, total: 1000 },
    };
  }

  // 2. Lấy danh sách Public (Search + Pagination)
  // [CẬP NHẬT] Thêm categorySlug để hỗ trợ URL thân thiện
  async findAllPublic(query: FindAllPublicDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    // A. Xây dựng Where Condition
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      OR: [
        { stock: { gt: 0 } },
        { variants: { some: { stock: { gt: 0 } } } }
      ],
      ...(query.search ? { name: { contains: query.search } } : {}), // MySQL default case-insensitive
      ...(query.brandId ? { brandId: Number(query.brandId) } : {}),
    };

    if (query.tag) {
        // Tìm sản phẩm có chứa tag này trong chuỗi tags
        where.tags = { contains: query.tag };
    }

    // [LOGIC 1] Lọc theo Khoảng giá
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
        where.price = {};
        if (query.minPrice) where.price.gte = Number(query.minPrice);
        if (query.maxPrice) where.price.lte = Number(query.maxPrice);
    }

    // [LOGIC 2] Lọc theo Đánh giá
    if (query.rating) {
        where.rating = { gte: Number(query.rating) };
    }

    // [LOGIC 3] Lọc Danh mục Đệ quy (Như đã bàn)
    let targetCategoryId = query.categoryId;
    if (query.categorySlug) {
        const category = await this.prisma.category.findUnique({
            where: { slug: query.categorySlug },
            select: { id: true }
        });
        if (category) targetCategoryId = category.id;
    }

    if (targetCategoryId) {
        // Hàm này lấy cả cha lẫn con (đã viết ở CategoryService)
        const allCategoryIds = await this.categoryService.getAllDescendantIds(targetCategoryId);
        where.categoryId = { in: allCategoryIds };
    }

    // B. Xây dựng Sort Condition
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    switch (query.sort) {
        case 'price_asc': orderBy = { price: 'asc' }; break;
        case 'price_desc': orderBy = { price: 'desc' }; break;
        case 'sales': orderBy = { salesCount: 'desc' }; break;
        case 'rating': orderBy = { rating: 'desc' }; break;
    }

    // C. Query DB
    const [productIdsData, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        take: limit,
        skip: skip,
        orderBy: orderBy,
        select: { id: true }, // Chỉ lấy ID để tối ưu
      }),
      this.prisma.product.count({ where }),
    ]);

    const productIds = productIdsData.map((p) => p.id);
    // Hydrate dữ liệu từ Redis Cache (để đảm bảo nhanh)
    const products = await this.productCache.getProductsByIds(productIds);

    return {
      data: products,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  // --- 3. FIX BUG: Lấy chi tiết Public (Đã sửa lỗi Mapping & Type) ---
  async findOnePublic(idOrSlug: string) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    // [BƯỚC 1: KIỂM TRA CACHE]
    if (isUUID) {
      const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
      // Kiểm tra kỹ cache để tránh lỗi cũ
      if (cachedProduct && cachedProduct.status === 'ACTIVE' && cachedProduct.tiers) {
         return cachedProduct; 
      }
    }

    // [BƯỚC 2: QUERY DB]
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        seller: { select: { name: true, id: true, avatar: true } }, 
        options: {
            include: { values: { orderBy: { id: 'asc' } } },
            orderBy: { position: 'asc' } 
        },
        variants: true,
      },
    });

    if (!product || product.status !== 'ACTIVE') {
        throw new NotFoundException('Sản phẩm không tồn tại hoặc chưa được duyệt');
    }

    // [BƯỚC 3: MAPPING]
    const mappedProduct = {
        ...product,
        // [QUAN TRỌNG] Map rõ ràng các ID để Frontend dùng gọi API liên quan
        sellerId: product.sellerId || product.seller?.id, 
        categoryId: product.categoryId, 
        
        price: Number(product.price), 
        regularPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
        
        tiers: product.options.map(opt => ({
            name: opt.name,
            options: opt.values.map(v => v.value), 
            images: opt.values.map(v => v.image || '') 
        })),

        // Map Variations
        variations: product.variants.map(v => {
            let safeTierIndex: number[] = [];
            if (Array.isArray(v.tierIndex)) {
                safeTierIndex = v.tierIndex as number[];
            } else if (typeof v.tierIndex === 'string' && (v.tierIndex as string).length > 0) {
                safeTierIndex = (v.tierIndex as string).split(',').map(n => parseInt(n, 10));
            }

            return {
                ...v,
                price: Number(v.price),
                stock: Number(v.stock),
                sku: v.sku,
                imageUrl: v.image,
                tierIndex: safeTierIndex,
            };
        })
    };

    // [BƯỚC 4: UPDATE CACHE]
    if (isUUID) {
        await this.productCache.setProductDetail(product.id, mappedProduct); 
    }

    return mappedProduct; 
  }

  // 4. Lấy sản phẩm liên quan
  async findRelated(productId: string) {
    const currentProduct = await this.productCache.getProductDetail(productId);
    if (!currentProduct) return [];

    // [CẬP NHẬT] Tìm liên quan trong cùng cây danh mục (Logic nâng cao)
    // Nếu muốn chính xác hơn: const catIds = await this.categoryService.getAllDescendantIds(currentProduct.categoryId);
    // Tuy nhiên để tối ưu performance cho Related Product, ta tạm thời dùng categoryId trực tiếp
    return this.prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'ACTIVE',
        stock: { gt: 0 },
        categoryId: currentProduct.categoryId,
      },
      take: 12,
      orderBy: { salesCount: 'desc' },
      select: {
        id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true
      },
    });
  }

  async findShopProducts(shopId: string, query: { 
      page?: number; 
      limit?: number; 
      sort?: string; 
      categoryId?: string;
      minPrice?: number;
      maxPrice?: number;
      rating?: number;
  }) {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 12;
      const skip = (page - 1) * limit;

      // 1. Xây dựng điều kiện lọc (Where)
      const where: Prisma.ProductWhereInput = {
          shopId: shopId,
          status: 'ACTIVE',
          stock: { gt: 0 }, // Chỉ lấy hàng còn kho
      };

      // Lọc theo danh mục của Shop (Shop Category)
      if (query.categoryId && query.categoryId !== 'all') {
          where.shopCategoryId = query.categoryId;
      }

      // Lọc theo khoảng giá
      if (query.minPrice !== undefined || query.maxPrice !== undefined) {
          where.price = {};
          if (query.minPrice) where.price.gte = Number(query.minPrice);
          if (query.maxPrice) where.price.lte = Number(query.maxPrice);
      }

      // Lọc theo đánh giá (Rating >= X)
      if (query.rating) {
          where.rating = { gte: Number(query.rating) };
      }

      // 2. Xây dựng điều kiện sắp xếp (Order By)
      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }; // Mặc định: Mới nhất

      switch (query.sort) {
          case 'price_asc':
              orderBy = { price: 'asc' };
              break;
          case 'price_desc':
              orderBy = { price: 'desc' };
              break;
          case 'sales':
              orderBy = { salesCount: 'desc' };
              break;
          case 'rating':
              orderBy = { rating: 'desc' };
              break;
          default: // 'newest'
              orderBy = { createdAt: 'desc' };
      }

      // 3. Query Database
      const [products, total] = await Promise.all([
          this.prisma.product.findMany({
              where,
              take: limit,
              skip,
              orderBy,
          }),
          this.prisma.product.count({ where })
      ]);

      return {
          data: products,
          meta: {
              total,
              page,
              limit,
              last_page: Math.ceil(total / limit)
          }
      };
  }
  
  // ... (Giữ nguyên phần findMoreFromShop, findBoughtTogether, searchProductsForAdmin)
  async findMoreFromShop(productId: string) {
    const cachedProduct = await this.productCache.getProductDetail(productId);
    let shopId = cachedProduct?.shopId; 

    if (!shopId) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { shopId: true } 
      });
      shopId = product?.shopId;
    }

    if (!shopId) return [];

    // B2: Query DB theo shopId
    return this.prisma.product.findMany({
      where: {
        shopId: shopId,         
        id: { not: productId },  
        status: 'ACTIVE',
        // stock: { gt: 0 },      
      },
      take: 6, 
      orderBy: { createdAt: 'desc' }, 
      select: {
        id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true
      },
    });
  }

  // 6. Sản phẩm mua kèm (Frequently Bought Together)
  async findBoughtTogether(productId: string) {
    const cacheKey = `product:bought_together:${productId}`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    const orders = await this.prisma.orderItem.findMany({
      where: { productId: productId },
      select: { orderId: true },
      take: 50,
      orderBy: { order: { createdAt: 'desc' } }
    });

    const orderIds = orders.map(o => o.orderId);
    if (orderIds.length === 0) return [];

    const relatedItems = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        orderId: { in: orderIds },
        productId: { not: productId }
      },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 6
    });

    const relatedIds = relatedItems.map(item => item.productId);

    if (relatedIds.length > 0) {
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: relatedIds },
                status: 'ACTIVE'
            },
            include: {
                options: { include: { values: true } },
                variants: true 
            }
        });
        const activeProducts = products.filter(p => p.status === 'ACTIVE' && p.stock > 0);
        
        await this.redis.set(cacheKey, JSON.stringify(activeProducts), 'EX', 86400);
        return activeProducts;
    }

    return [];
  }

  async searchProductsForAdmin(query: string) {
    return this.prisma.product.findMany({
      where: {
        name: { contains: query }, // MySQL default case-insensitive
        // status: 'ACTIVE', // Uncomment nếu chỉ muốn tìm sp đang bán
      },
      select: {
        id: true,
        name: true,
        images: true, // Lấy ảnh để hiện thumbnail
        price: true,
      },
      take: 20, // Limit kết quả
    });
  }
}