// BE-00010/modules/product/services/product-read.service.ts

import { Inject, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../database/redis/redis.constants';
import { ProductCacheService } from './product-cache.service';
import { CategoryService } from '../../category/category.service';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { escape } from 'querystring';
interface FindAllPublicDto {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  categorySlug?: string;
  brandId?: number;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  sort?: string;
  tag?: string;
}

const SUGGESTION_KEY = 'sug:products';

@Injectable()
export class ProductReadService implements OnModuleInit {
  private readonly logger = new Logger(ProductReadService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly productCache: ProductCacheService,
    private readonly categoryService: CategoryService,
  ) {}

  async onModuleInit() {
    // 1. Tạo Index cho Full Search (Trang kết quả)
    try {
      await this.redis.call(
        'FT.CREATE', 'idx:products', 
        'ON', 'HASH', 
        'PREFIX', '1', 'product:', 
        'SCHEMA', 
        'name', 'TEXT', 'WEIGHT', '5.0', 'SORTABLE', 
        'slug', 'TEXT', 'NOSTEM', 
        'price', 'NUMERIC', 'SORTABLE',
        'salesCount', 'NUMERIC', 'SORTABLE',
        'status', 'TAG'
      );
      this.logger.log('RediSearch Index created');
      this.logger.log('🔄 Auto-syncing products to Redis...');
      await this.syncAllProductsToRedis();
    } catch (e: any) {
      // Ignore if exists
    }
  }

  // [QUAN TRỌNG] Hàm này dùng để đồng bộ sản phẩm ban đầu vào Redis
  async syncAllProductsToRedis() {
    // Lấy thêm originalPrice nếu cần
    const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { 
            id: true, name: true, price: true, salesCount: true, 
            status: true, slug: true, images: true, originalPrice: true 
        }
    });

    const pipeline = this.redis.pipeline();
    
    // Xóa suggestion cũ
    await this.redis.del(SUGGESTION_KEY);

    for (const p of products) {
        const key = `product:${p.id}`;
        const image = Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as any) : '';

        // [QUAN TRỌNG] Tạo sẵn cục JSON cho Frontend để lúc Search không cần map lại
        const frontendJson = JSON.stringify({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: Number(p.price),
            originalPrice: Number(p.originalPrice || 0),
            images: [image],
            salesCount: p.salesCount || 0,
        });

        // 1. Lưu Hash: Thêm field 'json'
        pipeline.hset(key, {
            name: p.name,
            price: Number(p.price),
            salesCount: p.salesCount || 0,
            status: p.status,
            id: p.id,
            slug: p.slug,
            json: frontendJson // <--- Field mới này giúp tăng tốc 10x
        });

        // 2. Dictionary cho Autocomplete
        const score = p.salesCount > 0 ? p.salesCount : 1;
        const payload = JSON.stringify({ id: p.id, slug: p.slug, price: Number(p.price), image });
        
        pipeline.call('FT.SUGADD', SUGGESTION_KEY, p.name, score.toString(), 'PAYLOAD', payload);
    }
    
    await pipeline.exec();
    this.logger.log(`Synced ${products.length} products to Redis with JSON pre-compute`);
    return { count: products.length };
  }

  private escapeRediSearch(str: string): string {
    // Escape các ký tự đặc biệt của RediSearch để tránh Syntax Error gây delay
    return str.replace(/([^a-zA-Z0-9\s\u00C0-\u1EF9])/g, '\\$1').trim();
  }

  // [NEW] Hàm tìm kiếm gợi ý siêu tốc (Autocomplete)
  async searchSuggestions(keyword: string) {
    if (!keyword || keyword.length < 2) return [];

    try {
        // FT.SUGGET key prefix [FUZZY] [MAX n] [WITHPAYLOADS]
        const suggestions: any = await this.redis.call(
            'FT.SUGGET', 
            SUGGESTION_KEY, 
            keyword, 
            'FUZZY', 
            'MAX', '6', 
            'WITHPAYLOADS' 
        );

        const result: any = [];
        for (let i = 0; i < suggestions.length; i += 2) {
            const name = suggestions[i];
            const payloadStr = suggestions[i + 1];
            if (payloadStr) {
                const data: any = JSON.parse(payloadStr);
                result.push({
                    id: data.id,
                    name: name,
                    price: data.price,
                    slug: data.slug,
                    images: [data.image] 
                });
            }
        }
        return result;

    } catch (error) {
        this.logger.error(`Suggestion error: ${error}`);
        return []; 
    }
  }

  async syncProductToRedis(product: any) {
    const key = `product:${product.id}`;
    const image = Array.isArray(product.images) && product.images.length > 0 ? (product.images[0] as any) : '';

    // Tạo cục JSON giống hệt hàm syncAll
    const frontendJson = JSON.stringify({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        originalPrice: Number(product.originalPrice || 0),
        images: [image],
        salesCount: product.salesCount || 0,
    });

    // Update Redis Hash bao gồm cả field 'json'
    await this.redis.hset(key, {
      name: product.name,
      // description: product.description || '', // (Bỏ bớt nếu không cần search description để tiết kiệm RAM)
      price: Number(product.price),
      salesCount: product.salesCount || 0,
      status: product.status,
      id: product.id,
      slug: product.slug,
      json: frontendJson // <--- QUAN TRỌNG NHẤT
    });
    
    // Update luôn Dictionary cho Suggestion
    const score = product.salesCount > 0 ? product.salesCount : 1;
    const payload = JSON.stringify({ id: product.id, slug: product.slug, price: Number(product.price), image });
    await this.redis.call('FT.SUGADD', 'sug:products', product.name, score.toString(), 'PAYLOAD', payload);
  }

  // 1. Lấy Feed cá nhân hóa
  async getPersonalizedFeed(userId: string, page: number, limit: number) {
    const trackingKey = `user:affinity:${userId}`;
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    let productIds = await this.redis.zrevrange(trackingKey, start, stop);

    if (productIds.length === 0) {
      productIds = await this.redis.zrevrange('global:trending', start, stop);
    }

    const products = await this.productCache.getProductsByIds(productIds);
    let activeProducts = products.filter(p => p.status === 'ACTIVE');

    if (activeProducts.length < limit) {
        const missingCount = limit - activeProducts.length;
        const dbFallback = await this.findAllPublic({ page: 1, limit: missingCount });

        const currentIds = new Set(activeProducts.map(p => p.id));
        const newItems = dbFallback.data.filter((p: any) => !currentIds.has(p.id));
        
        activeProducts = [...activeProducts, ...newItems];
    }

    return {
      data: activeProducts,
      meta: { page, limit, total: 1000 },
    };
  }

  // 2. Lấy danh sách Public (Search + Pagination)
  async findAllPublic(query: FindAllPublicDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    // 1. Gợi ý nhanh (Autocomplete) - Giữ nguyên logic cũ của bạn
    const isSuggestionMode = limit <= 10 && !query.categorySlug && !query.minPrice;
    if (isSuggestionMode && query.search && query.search.trim().length >= 2) {
        const suggestions = await this.searchSuggestions(query.search);
        if (suggestions.length > 0) {
            return { 
                data: suggestions, 
                meta: { total: suggestions.length, page, limit, last_page: 1 } 
            };
        }
    }

    // 2. Cache Layer (Kết quả tìm kiếm lặp lại)
    const queryHash = createHash('md5').update(JSON.stringify(query)).digest('hex');
    const cacheKey = `search:res:${queryHash}`;

    // Fail-fast Cache
    if (!query.search || query.search.length < 2) {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    }

    let resultData: any = null;

    // --- LOGIC 1: REDISEARCH (TỐI ƯU HÓA) ---
    if (query.search && query.search.trim().length > 0) {
        try {
            const cleanKeyword = this.escapeRediSearch(query.search);
            
            if (cleanKeyword) {
                // Tạo query tìm kiếm theo prefix (VD: "iphone" -> "iphone*")
                // Tách từ khóa để tìm chính xác hơn
                const terms = cleanKeyword.split(/\s+/).filter(t => t.length > 0).map(t => `${t}*`).join(' ');
                
                // Query: Active + Name chứa terms
                const ftQuery = `@status:{ACTIVE} @name:(${terms})`;

                // [FIX QUAN TRỌNG] Gọi trực tiếp, bỏ setTimeout 300ms
                // RETURN 1 json: Chỉ lấy đúng field 'json' đã tạo ở bước 1
                const searchRes: any = await this.redis.call(
                    'FT.SEARCH', 'idx:products', 
                    ftQuery,
                    'LIMIT', skip, limit,
                    'SORTBY', 'salesCount', 'DESC', 
                    'RETURN', '1', 'json' 
                );

                // Cấu trúc trả về của FT.SEARCH: [Total, Key1, [Fields1], Key2, [Fields2]...]
                const total = searchRes[0];
                const products: any[] = [];

                for (let i = 1; i < searchRes.length; i += 2) {
                    const fields = searchRes[i + 1]; // Array dạng ['json', '{...}']
                    
                    // Lấy giá trị của field 'json' (nằm ở index 1 của mảng fields)
                    if (fields && fields.length >= 2 && fields[0] === 'json') {
                         // Parse JSON trực tiếp -> Không tốn CPU mapping thủ công
                         products.push(JSON.parse(fields[1]));
                    }
                }

                resultData = {
                    data: products,
                    meta: { total, page, limit, last_page: Math.ceil(total / limit) },
                };
            }
        } catch (e) {
            this.logger.warn(`RediSearch Error: ${e.message}`);
            // Không throw lỗi, để nó tự fallback xuống DB bên dưới
        }
    }

    // --- LOGIC 2: DB FALLBACK (Nếu Redis lỗi hoặc chưa có data) ---
    if (!resultData) {
        const where: Prisma.ProductWhereInput = {
            status: 'ACTIVE',
            ...(query.search ? { name: { contains: query.search.trim() } } : {}), // Bỏ mode 'insensitive' nếu dùng MySQL bản cũ để nhanh hơn
            ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
            ...(query.minPrice ? { price: { gte: Number(query.minPrice) } } : {}),
            ...(query.maxPrice ? { price: { lte: Number(query.maxPrice) } } : {}),
        };

        // Promise.all để chạy song song count và query
        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                take: limit,
                skip: skip,
                orderBy: { salesCount: 'desc' },
                select: { 
                    id: true, name: true, price: true, slug: true, 
                    images: true, salesCount: true, originalPrice: true
                }
            }),
            this.prisma.product.count({ where })
        ]);

        resultData = {
            data: products.map(p => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                price: Number(p.price),
                originalPrice: Number(p.originalPrice || 0),
                // Xử lý ảnh an toàn
                images: Array.isArray(p.images) ? p.images : [],
                salesCount: p.salesCount || 0
            })),
            meta: {
                total,
                page,
                limit,
                last_page: Math.ceil(total / limit),
            },
        };
    }

    // Cache kết quả cuối cùng 60s để giảm tải cho những query trùng lặp
    if (resultData?.data?.length > 0) {
        await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', 60);
    }
    
    return resultData;
}

  // 3. Lấy chi tiết Public
  async findOnePublic(idOrSlug: string) {
    // 1. Kiểm tra Cache
    const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
    if (cachedProduct && cachedProduct.status === 'ACTIVE') {
      return cachedProduct;
    }

    // 2. Tìm trong DB
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          {
            slug: {
              equals: idOrSlug,
            },
          },
        ],
      },
      include: {
        seller: { select: { name: true, id: true, avatar: true } },
        options: {
          include: { values: { orderBy: { id: 'asc' } } },
          orderBy: { position: 'asc' },
        },
        variants: true,
      },
    });

    if (!product || product.status !== 'ACTIVE') {
      // Log để debug xem tại sao không tìm thấy
      this.logger.warn(`Product not found with ID/Slug: ${idOrSlug}`);
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    // 3. Map dữ liệu (Logic cũ của bạn giữ nguyên)
    const mappedProduct = {
        ...product,
        sellerId: product.sellerId || product.seller?.id, 
        categoryId: product.categoryId, 
        price: Number(product.price), 
        regularPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
        tiers: product.options.map(opt => ({
            name: opt.name,
            options: opt.values.map(v => v.value), 
            images: opt.values.map(v => v.image || '') 
        })),
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

    // 4. [FIX QUAN TRỌNG] Lưu Cache đúng tham số (ID, Slug, Data)
    // Lưu cache bất kể tìm bằng ID hay Slug để lần sau truy cập nhanh hơn
    await this.productCache.setProductDetail(product.id, product.slug, mappedProduct);
    
    return mappedProduct; 
  }

  // 4. Lấy sản phẩm liên quan
  async findRelated(productId: string) {
    const currentProduct = await this.productCache.getProductDetail(productId);
    if (!currentProduct) return [];

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

  // 5. Tìm sản phẩm trong Shop
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

      const where: Prisma.ProductWhereInput = {
          shopId: shopId,
          status: 'ACTIVE',
          stock: { gt: 0 }, 
      };

      if (query.categoryId && query.categoryId !== 'all') {
          where.shopCategoryId = query.categoryId;
      }

      if (query.minPrice !== undefined || query.maxPrice !== undefined) {
          where.price = {};
          if (query.minPrice) where.price.gte = Number(query.minPrice);
          if (query.maxPrice) where.price.lte = Number(query.maxPrice);
      }

      if (query.rating) {
          where.rating = { gte: Number(query.rating) };
      }

      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }; 

      switch (query.sort) {
          case 'price_asc': orderBy = { price: 'asc' }; break;
          case 'price_desc': orderBy = { price: 'desc' }; break;
          case 'sales': orderBy = { salesCount: 'desc' }; break;
          case 'rating': orderBy = { rating: 'desc' }; break;
          default: orderBy = { createdAt: 'desc' };
      }

      const [products, total] = await Promise.all([
          this.prisma.product.findMany({ where, take: limit, skip, orderBy }),
          this.prisma.product.count({ where })
      ]);

      return {
          data: products,
          meta: { total, page, limit, last_page: Math.ceil(total / limit) }
      };
  }
  
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

    return this.prisma.product.findMany({
      where: {
        shopId: shopId,         
        id: { not: productId },  
        status: 'ACTIVE',
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

    const relatedIds = relatedItems
        .map(item => item.productId)
        .filter((id): id is string => id !== null);

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
      where: { name: { contains: query } },
      select: {
        id: true, name: true, images: true, variants: true, price: true,
      },
      take: 20, 
    });
  }

  async findAllForSeller(sellerId: string, query: { page?: number; limit?: number; keyword?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { shopId: sellerId };

    if (query.keyword) {
      where.name = { contains: query.keyword };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where, take: limit, skip,
        orderBy: { createdAt: 'desc' },
        include: { variants: true, category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { total, page, limit, last_page: Math.ceil(total / limit) },
    };
  }
}