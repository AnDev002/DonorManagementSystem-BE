// BE-00010/modules/product/services/product-read.service.ts

import { Inject, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../database/redis/redis.constants';
import { ProductCacheService } from './product-cache.service';
import { CategoryService } from '../../category/category.service';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';

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
const INDEX_NAME = 'idx:products';

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
    try {
        // 1. Kiểm tra xem Index đã tồn tại chưa
        const info = await this.redis.call('FT.INFO', INDEX_NAME).catch(() => null);

        if (info) {
            // === TRƯỜNG HỢP A: Index ĐÃ TỒN TẠI ===
            const infoStr = JSON.stringify(info);

            // A1. Kiểm tra cấu trúc cũ (thiếu systemTags) -> Xóa đi tạo lại
            if (!infoStr.includes('systemTags')) {
                this.logger.warn('⚠️ Old Index Schema detected. Re-creating index...');
                await this.redis.call('FT.DROPINDEX', INDEX_NAME);
                await this.createSearchIndex();
            } else {
                // A2. Index đã đúng schema -> Kiểm tra xem có dữ liệu bên trong không?
                // Dùng FT.SEARCH đếm số lượng doc (nhanh hơn scan keys)
                const searchCount: any = await this.redis.call('FT.SEARCH', INDEX_NAME, '*', 'LIMIT', '0', '0');
                
                // searchCount[0] là tổng số kết quả. Nếu = 0 tức là Index rỗng -> Sync lại
                if (Array.isArray(searchCount) && searchCount[0] === 0) {
                    this.logger.warn('⚠️ Index exists but EMPTY (0 docs). Force syncing data...');
                    await this.syncAllProductsToRedis();
                } else {
                    this.logger.log('✅ Index check passed. Ready to search.');
                }
            }
        } else {
            // === TRƯỜNG HỢP B: Index CHƯA TỒN TẠI ===
            // (Code cũ của bạn bị thiếu đoạn này nên Index không bao giờ được tạo)
            this.logger.warn('⚠️ Index not found. Creating new Index...');
            await this.createSearchIndex();
        }
    } catch (e: any) {
        this.logger.error(`Init Index Error: ${e.message}`);
    }
  }

  private async createSearchIndex() {
      try {
        await this.redis.call(
            'FT.CREATE', INDEX_NAME, 
            'ON', 'HASH', 
            'PREFIX', '1', 'product:', 
            'SCHEMA', 
            'name', 'TEXT', 'WEIGHT', '5.0', 'SORTABLE', 
            'slug', 'TEXT', 'NOSTEM', 
            'price', 'NUMERIC', 'SORTABLE',
            'salesCount', 'NUMERIC', 'SORTABLE',
            'status', 'TAG',
            'systemTags', 'TAG' // Field quan trọng
        );
        this.logger.log('✅ RediSearch Index created');
        this.logger.log('🔄 Auto-syncing products to Redis...');
        await this.syncAllProductsToRedis();
      } catch (e) {
        // Bỏ qua lỗi nếu index đã tồn tại (dù đã check ở trên nhưng an toàn vẫn hơn)
      }
  }

  // [QUAN TRỌNG] Hàm này dùng để đồng bộ sản phẩm ban đầu vào Redis
  async syncAllProductsToRedis() {
    // Lấy thêm originalPrice và systemTags
    const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { 
            id: true, name: true, price: true, salesCount: true, 
            status: true, slug: true, images: true, originalPrice: true,
            systemTags: true 
        }
        
    }
  );

    const pipeline = this.redis.pipeline();
    
    // Xóa suggestion cũ
    await this.redis.del(SUGGESTION_KEY);

    for (const p of products) {
        const key = `product:${p.id}`;
        const image = Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as any) : '';

        // [FIX] Ép kiểu từ JsonValue sang string[] an toàn
        const tags = Array.isArray(p.systemTags) ? (p.systemTags as string[]) : [];
        const tagsString = tags.join(',');

        // Tạo sẵn cục JSON cho Frontend
        const frontendJson = JSON.stringify({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: Number(p.price),
            originalPrice: Number(p.originalPrice || 0),
            images: [image],
            salesCount: p.salesCount || 0,
        });

        // Lưu Hash
        pipeline.hset(key, {
            name: p.name,
            price: Number(p.price),
            salesCount: p.salesCount || 0,
            status: p.status,
            id: p.id,
            slug: p.slug,
            json: frontendJson,
            systemTags: tagsString // Lưu chuỗi tags vào Redis
        });

        // Dictionary cho Autocomplete
        const score = p.salesCount > 0 ? p.salesCount : 1;
        const payload = JSON.stringify({ id: p.id, slug: p.slug, price: Number(p.price), image });
        
        pipeline.call('FT.SUGADD', SUGGESTION_KEY, p.name, score.toString(), 'PAYLOAD', payload);
    }
    
    await pipeline.exec();
    this.logger.log(`Synced ${products.length} products to Redis with JSON pre-compute`);
    return { count: products.length };
  }

  private escapeRediSearch(str: string): string {
    // Escape các ký tự đặc biệt của RediSearch
    // Cho phép dấu cách và ký tự tiếng Việt
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

    // [FIX] Ép kiểu từ JsonValue sang string[] an toàn
    const tags = Array.isArray(product.systemTags) ? (product.systemTags as string[]) : [];
    const tagsString = tags.join(',');

    // Tạo cục JSON
    const frontendJson = JSON.stringify({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        originalPrice: Number(product.originalPrice || 0),
        images: [image],
        salesCount: product.salesCount || 0,
    });

    // Update Redis Hash
    await this.redis.hset(key, {
      name: product.name,
      price: Number(product.price),
      salesCount: product.salesCount || 0,
      status: product.status,
      id: product.id,
      slug: product.slug,
      json: frontendJson,
      systemTags: tagsString // Update tags
    });
    
    // Update Dictionary
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

    // 1. Gợi ý nhanh (Autocomplete)
    const isSuggestionMode = limit <= 10 && !query.categorySlug && !query.minPrice && !query.tag;
    if (isSuggestionMode && query.search && query.search.trim().length >= 2) {
        const suggestions = await this.searchSuggestions(query.search);
        if (suggestions.length > 0) {
            return { 
                data: suggestions, 
                meta: { total: suggestions.length, page, limit, last_page: 1 } 
            };
        }
    }

    // 2. Cache Layer
    const queryHash = createHash('md5').update(JSON.stringify(query)).digest('hex');
    const cacheKey = `search:res:${queryHash}`;

    // Fail-fast Cache (Chỉ cache khi không có search text ngắn hoặc tag)
    if ((!query.search || query.search.length < 2) && !query.tag) {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    }

    let resultData: any = null;

    // --- LOGIC 1: REDISEARCH ---
    if ((query.search && query.search.trim().length > 0) || query.tag) {
        try {
            let ftQuery = `@status:{ACTIVE}`;

            // [FIX] Xử lý Search Keyword: Tìm trong Name HOẶC SystemTags
            if (query.search && query.search.trim().length > 0) {
                const cleanKeyword = this.escapeRediSearch(query.search);
                if (cleanKeyword) {
                    // Xử lý Name (Prefix matching: valen* -> valentine)
                    const nameTerms = cleanKeyword.split(/\s+/).filter(t => t.length > 0).map(t => `${t}*`).join(' ');
                    
                    // [FIX] Xử lý Tags (Exact matching cho từng token: {valentine} | {gift})
                    // Nếu muốn tìm chính xác cụm thì giữ nguyên, nhưng thường user muốn tìm lỏng hơn.
                    const tagTerms = cleanKeyword.split(/\s+/).filter(t => t.length > 0).map(t => `{${t}}`).join(' | ');

                    // Query: (Tên chứa các từ...) HOẶC (Tag chứa tag "nguyên cụm" HOẶC chứa "từng từ")
                    ftQuery += ` (@name:(${nameTerms}) | @systemTags:{${cleanKeyword}} | @systemTags:(${tagTerms}))`;
                }
            }

            // Xử lý Filter Tag (nếu URL có ?tag=...)
            if (query.tag) {
                const cleanTag = this.escapeRediSearch(query.tag);
                if (cleanTag) {
                     ftQuery += ` @systemTags:{${cleanTag}}`;
                }
            }
            
            // Search nếu có keyword hoặc tag
            const isValidSearch = query.search || query.tag;

            if (isValidSearch) {
                const searchRes: any = await this.redis.call(
                    'FT.SEARCH', INDEX_NAME, 
                    ftQuery,
                    'LIMIT', skip, limit,
                    'SORTBY', 'salesCount', 'DESC', 
                    'RETURN', '1', 'json' 
                );

                const total = searchRes[0];
                
                // Chỉ lấy kết quả nếu tìm thấy > 0
                if (total > 0) {
                    const products: any[] = [];
                    for (let i = 1; i < searchRes.length; i += 2) {
                        const fields = searchRes[i + 1];
                        if (fields && fields.length >= 2 && fields[0] === 'json') {
                            products.push(JSON.parse(fields[1]));
                        }
                    }

                    resultData = {
                        data: products,
                        meta: { total, page, limit, last_page: Math.ceil(total / limit) },
                    };
                }
            }
        } catch (e) {
            this.logger.warn(`RediSearch Error: ${e.message}`);
        }
    }

    // --- LOGIC 2: DB FALLBACK ---
    // Chạy vào đây nếu RediSearch lỗi HOẶC trả về 0 kết quả (resultData vẫn là null)
    if (!resultData) {
        const where: Prisma.ProductWhereInput = {
            status: 'ACTIVE',
            ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
            ...(query.minPrice ? { price: { gte: Number(query.minPrice) } } : {}),
            ...(query.maxPrice ? { price: { lte: Number(query.maxPrice) } } : {}),
            
            // [FIX QUAN TRỌNG] Fallback cho Search: Tìm Name HOẶC SystemTags
            ...(query.search ? {
                OR: [
                    { name: { contains: query.search.trim() } },
                    // Tìm trong JSON array bằng string_contains (hack cho MySQL JSON)
                    { systemTags: { string_contains: query.search.trim() } }
                ]
            } : {}),
            
            // Fallback cho Tag param
            ...(query.tag ? { 
                systemTags: { 
                    string_contains: `"${query.tag}"` 
                } 
            } : {}),
        };

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

    if (resultData?.data?.length > 0) {
        await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', 60);
    }
    
    return resultData;
  }

  // 3. Lấy chi tiết Public
  async findOnePublic(idOrSlug: string) {
    const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
    if (cachedProduct && cachedProduct.status === 'ACTIVE') {
      return cachedProduct;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: { equals: idOrSlug } },
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
      this.logger.warn(`Product not found with ID/Slug: ${idOrSlug}`);
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

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