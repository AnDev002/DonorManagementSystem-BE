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
  locations?: string[]; // [THÊM] Filter theo địa điểm
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
    // Tự động kiểm tra và tạo lại Index khi khởi động
    await this.ensureSearchIndex();
  }

  // ===========================================================================
  // [FIX 1] DATA CLEANING - Làm sạch dữ liệu rác từ Crawler
  // ===========================================================================
  private cleanSystemTags(inputTags: any): string {
    let tags: string[] = [];

    // 1. Chuẩn hóa input
    if (Array.isArray(inputTags)) {
        tags = inputTags;
    } else if (typeof inputTags === 'string') {
        try {
            const parsed = JSON.parse(inputTags);
            if (Array.isArray(parsed)) tags = parsed;
        } catch {
            tags = inputTags.split(',');
        }
    }

    if (!tags || tags.length === 0) return '';

    const cleanedTags = tags
        .map(tag => {
            if (typeof tag !== 'string') return '';
            
            let clean = tag;
            // A. Decode URL
            try { clean = decodeURIComponent(clean); } catch {}

            // B. Xóa Rác URL
            clean = clean.replace(/.*(\?|&)q=/, '').replace(/.*(\?|&)keyword=/, '');
            
            // C. Xóa ký tự đặc biệt
            clean = clean.replace(/[{}()\[\]|@!<>"`'\\]/g, ' ');

            // D. Chuẩn hóa khoảng trắng
            return clean.trim().replace(/\s+/g, ' ');
        })
        .filter(t => t.length > 0 && t.length < 50);

    return Array.from(new Set(cleanedTags)).join(','); 
  }

  // ===========================================================================
  // [FIX 2] REDIS HELPERS - Xử lý Query an toàn
  // ===========================================================================
  
  private escapeRediSearchText(str: string): string {
    return str.replace(/([^a-zA-Z0-9\s\u00C0-\u1EF9\-])/g, '\\$1').trim();
  }

  private sanitizeTagKeyword(str: string): string {
      return str.replace(/[{}\|@*()\\\[\]]/g, ' ').trim().replace(/\s+/g, ' ');
  }

  private async ensureSearchIndex() {
      try {
        const info = await this.redis.call('FT.INFO', INDEX_NAME).catch(() => null);
        
        if (!info) {
            this.logger.warn('⚠️ Index not found. Creating new Index...');
            await this.createSearchIndex();
        } else {
            const infoStr = JSON.stringify(info);
            // Kiểm tra xem Index cũ có trường 'rating' và 'location' chưa
            if (!infoStr.includes('rating') || !infoStr.includes('location')) {
                this.logger.warn('⚠️ Old Index Schema detected (Missing rating/location). Re-creating index...');
                await this.redis.call('FT.DROPINDEX', INDEX_NAME);
                await this.createSearchIndex();
            } else {
                this.logger.log('✅ Index check passed. Ready to search.');
            }
        }
      } catch (e: any) {
         this.logger.error(`Ensure Index Error: ${e.message}`);
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
            'rating', 'NUMERIC', 'SORTABLE', // [NEW] Filter theo sao
            'location', 'TAG',               // [NEW] Filter theo địa điểm
            'status', 'TAG',
            'systemTags', 'TAG'
        );
        this.logger.log('✅ RediSearch Index created');
        this.logger.log('🔄 Auto-syncing products to Redis...');
        await this.syncAllProductsToRedis();
      } catch (e: any) {
         if(!e.message?.includes('already exists')) {
             this.logger.error(`Create Index Error: ${e.message}`);
         }
      }
  }

  async syncAllProductsToRedis() {
    try {
        // [UPDATE] Select thêm rating và shop.city
        const products = await this.prisma.product.findMany({
            where: { status: 'ACTIVE' },
            select: { 
                id: true, name: true, price: true, salesCount: true, 
                status: true, slug: true, images: true, originalPrice: true,
                systemTags: true, rating: true,
                shop: { select: { city: true } } 
            }
        });

        const pipeline = this.redis.pipeline();
        await this.redis.del(SUGGESTION_KEY);

        for (const p of products) {
            const key = `product:${p.id}`;
            const image = Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as any) : '';
            const tagsString = this.cleanSystemTags(p.systemTags);
            
            // [UPDATE] Lấy location từ shop city, mặc định là 'Khác' nếu null
            const location = p.shop?.city ? this.sanitizeTagKeyword(p.shop.city) : 'Khac';

            const frontendJson = JSON.stringify({
                id: p.id,
                name: p.name,
                slug: p.slug,
                price: Number(p.price),
                originalPrice: Number(p.originalPrice || 0),
                images: [image],
                salesCount: p.salesCount || 0,
                location: p.shop?.city // Lưu vào JSON để frontend hiển thị ngay
            });

            pipeline.hset(key, {
                name: p.name,
                price: Number(p.price),
                salesCount: p.salesCount || 0,
                rating: Number(p.rating || 0), // [NEW]
                location: location,            // [NEW]
                status: p.status,
                id: p.id,
                slug: p.slug,
                json: frontendJson,
                systemTags: tagsString,
                createdAt: new Date(p.createdAt).getTime(),
            });

            const score = p.salesCount > 0 ? p.salesCount : 1;
            const payload = JSON.stringify({ id: p.id, slug: p.slug, price: Number(p.price), image });
            pipeline.call('FT.SUGADD', SUGGESTION_KEY, p.name, score.toString(), 'PAYLOAD', payload);
        }
        
        await pipeline.exec();
        this.logger.log(`Synced ${products.length} products to Redis with CLEANED tags & filters.`);
        return { count: products.length };
    } catch (e: any) {
        this.logger.error(`Sync Error: ${e.message}`);
    }
  }

  async syncProductToRedis(product: any) {
    // [NOTE] Khi gọi hàm này từ nơi khác, cần đảm bảo object product có include shop
    // Nếu chưa có shop, nên query lại DB để lấy đầy đủ info
    const fullProduct = await this.prisma.product.findUnique({
        where: { id: product.id },
        include: { shop: { select: { city: true } } }
    });
    
    if(!fullProduct) return;

    const key = `product:${fullProduct.id}`;
    const image = Array.isArray(fullProduct.images) && fullProduct.images.length > 0 ? (fullProduct.images[0] as any) : '';
    const tagsString = this.cleanSystemTags(fullProduct.systemTags);
    const location = fullProduct.shop?.city ? this.sanitizeTagKeyword(fullProduct.shop.city) : 'Khac';

    const frontendJson = JSON.stringify({
        id: fullProduct.id,
        name: fullProduct.name,
        slug: fullProduct.slug,
        price: Number(fullProduct.price),
        originalPrice: Number(fullProduct.originalPrice || 0),
        images: [image],
        salesCount: fullProduct.salesCount || 0,
        location: fullProduct.shop?.city
    });

    await this.redis.hset(key, {
      name: fullProduct.name,
      price: Number(fullProduct.price),
      salesCount: fullProduct.salesCount || 0,
      rating: Number(fullProduct.rating || 0),
      location: location,
      status: fullProduct.status,
      id: fullProduct.id,
      slug: fullProduct.slug,
      json: frontendJson,
      systemTags: tagsString
    });
    
    const score = fullProduct.salesCount > 0 ? fullProduct.salesCount : 1;
    const payload = JSON.stringify({ id: fullProduct.id, slug: fullProduct.slug, price: Number(fullProduct.price), image });
    await this.redis.call('FT.SUGADD', SUGGESTION_KEY, fullProduct.name, score.toString(), 'PAYLOAD', payload);
  }

  // ===========================================================================
  // [FIX 3] SEARCH LOGIC - Nâng cấp Filter
  // ===========================================================================
  async findAllPublic(query: FindAllPublicDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    // Cache Key bao gồm cả các params filter
    const queryHash = createHash('md5').update(JSON.stringify(query)).digest('hex');
    const cacheKey = `search:res:${queryHash}`;

    let resultData: any = null;
    const searchKeyword = query.search ? query.search.trim() : '';
    
    // Điều kiện để dùng Redis Search: Có keyword/tag HOẶC có filter nâng cao
    const shouldUseRedis = searchKeyword.length > 0 || query.tag || query.minPrice || query.maxPrice || query.rating || (query.locations && query.locations.length > 0);

    // --- BƯỚC 1: REDIS SEARCH ---
    if (shouldUseRedis) {
        try {
            this.logger.log(`🔎 [Redis] Searching...`);
            
            let ftQuery = `@status:{ACTIVE}`;
            const conditions: string[] = [];

            // 1. Text Search
            if (searchKeyword) {
                const cleanName = this.escapeRediSearchText(searchKeyword);
                if (cleanName) {
                    const nameTokens = cleanName.split(/\s+/).map(t => `${t}*`).join(' ');
                    // Tìm trong name (ưu tiên cao) hoặc systemTags
                    conditions.push(`(@name:(${nameTokens}) | @systemTags:{${this.sanitizeTagKeyword(searchKeyword)}})`);
                }
            }
            if (conditions.length > 0) ftQuery += ` ${conditions.join(' ')}`;

            // 2. Tag Filter
            if (query.tag) {
                ftQuery += ` @systemTags:{${this.sanitizeTagKeyword(query.tag)}}`;
            }

            // 3. Location Filter
            if (query.locations && query.locations.length > 0) {
                const locStr = query.locations.map(l => this.sanitizeTagKeyword(l)).join(' | ');
                ftQuery += ` @location:{${locStr}}`;
            }

            // 4. Numeric Filters
            if (query.minPrice !== undefined || query.maxPrice !== undefined) {
                 const min = query.minPrice ?? -Infinity;
                 const max = query.maxPrice ?? Infinity;
                 ftQuery += ` @price:[${min} ${max}]`;
            }

            if (query.rating) {
                 ftQuery += ` @rating:[${query.rating} +inf]`;
            }

            // 5. Sorting
            let sortField = 'salesCount';
            let sortDir = 'DESC';
            if (query.sort === 'price_asc') { sortField = 'price'; sortDir = 'ASC'; }
            if (query.sort === 'price_desc') { sortField = 'price'; sortDir = 'DESC'; }

            // Gọi Redis
            const searchRes: any = await this.redis.call(
                'FT.SEARCH', INDEX_NAME, 
                ftQuery,
                'LIMIT', skip, limit,
                'SORTBY', sortField, sortDir, 
                'RETURN', '1', 'json' 
            );

            const total = searchRes[0];
            
            // Format kết quả từ Redis
            const products: any[] = [];
            for (let i = 1; i < searchRes.length; i += 2) {
                const fields = searchRes[i + 1];
                if (fields && fields.length >= 2) {
                    const jsonStr = fields[fields.indexOf('json') + 1];
                    if(jsonStr) products.push(JSON.parse(jsonStr));
                }
            }
            
            return {
                data: products,
                meta: { total, page, limit, last_page: Math.ceil(total / limit) },
            };

        } catch (e: any) {
            this.logger.error(`❌ [Redis] Error: ${e.message} -> Fallback to DB`);
        }
    }

    // --- BƯỚC 2: FALLBACK DATABASE (PRISMA FINDMANY) ---
    // Dùng findMany thay vì queryRaw để dễ xử lý filter phức tạp
    if (!resultData || resultData.data.length === 0) {
        this.logger.warn(`⚠️ [DB Fallback] Executing Prisma Query`);

        const where: Prisma.ProductWhereInput = {
            status: 'ACTIVE',
        };

        // 1. Text Search (Basic LIKE)
        if (searchKeyword) {
             where.OR = [
                { name: { contains: searchKeyword } }, 
                { systemTags: { contains: searchKeyword } }
            ];
        }

        // 2. Filters
        if (query.minPrice || query.maxPrice) {
            where.price = {};
            if (query.minPrice) where.price.gte = Number(query.minPrice);
            if (query.maxPrice) where.price.lte = Number(query.maxPrice);
        }

        if (query.rating) {
            where.rating = { gte: Number(query.rating) };
        }

        if (query.locations && query.locations.length > 0) {
            where.shop = {
                city: { in: query.locations }
            };
        }

        if (query.tag) {
            where.systemTags = { contains: query.tag };
        }

        // 3. Sorting
        let orderBy: any = { salesCount: 'desc' };
        if (query.sort === 'price_asc') orderBy = { price: 'asc' };
        if (query.sort === 'price_desc') orderBy = { price: 'desc' };
        if (query.sort === 'newest') orderBy = { createdAt: 'desc' };

        try {
            const [products, total] = await Promise.all([
                this.prisma.product.findMany({
                    where,
                    take: limit,
                    skip,
                    orderBy,
                    include: { 
                       shop: { select: { city: true } } // Để lấy location
                    }
                }),
                this.prisma.product.count({ where })
            ]);

            this.logger.log(`✅ [DB Fallback] Found ${total} items`);

            resultData = {
                data: products.map(p => ({
                    ...p,
                    price: Number(p.price),
                    originalPrice: Number(p.originalPrice || 0),
                    location: p.shop?.city,
                    images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
                })),
                meta: {
                    total,
                    page,
                    limit,
                    last_page: Math.ceil(total / limit),
                },
            };
        } catch (dbErr) {
            this.logger.error(`❌ [DB Fallback] Error: ${dbErr}`);
            return { data: [], meta: { total: 0, page, limit, last_page: 0 } };
        }
    }

    // Cache
    if (resultData?.data?.length > 0 && !query.search) {
        await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', 60);
    }
    
    return resultData || { data: [], meta: { total: 0, page: 1, limit, last_page: 0 } };
  }

  // ===========================================================================
  // Các hàm phụ trợ giữ nguyên
  // ===========================================================================

  async searchSuggestions(keyword: string) {
    if (!keyword || keyword.length < 2) return [];
    try {
        const suggestions: any = await this.redis.call(
            'FT.SUGGET', SUGGESTION_KEY, keyword, 'FUZZY', 'MAX', '6', 'WITHPAYLOADS' 
        );

        const result: any = [];
        for (let i = 0; i < suggestions.length; i += 2) {
            const name = suggestions[i];
            const payloadStr = suggestions[i + 1];
            if (payloadStr) {
                const data = JSON.parse(payloadStr);
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
        return []; 
    }
  }

  async findOnePublic(idOrSlug: string) {
    const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
    if (cachedProduct && cachedProduct.status === 'ACTIVE') {
      return cachedProduct;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        OR: [ { id: idOrSlug }, { slug: { equals: idOrSlug } } ],
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
      where: { shopId: shopId, id: { not: productId }, status: 'ACTIVE' },
      take: 6, 
      orderBy: { createdAt: 'desc' }, 
      select: {
        id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true
      },
    });
  }

  async searchProductsForAdmin(query: string) {
    return this.prisma.product.findMany({
      where: { name: { contains: query } },
      select: { id: true, name: true, images: true, variants: true, price: true },
      take: 20, 
    });
  }

  async findAllForSeller(sellerId: string, query: { page?: number; limit?: number; keyword?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = { shopId: sellerId };
    if (query.keyword) where.name = { contains: query.keyword };

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

  async findShopProducts(shopId: string, query: { 
      page?: number; limit?: number; sort?: string; 
      categoryId?: string; minPrice?: number; maxPrice?: number; rating?: number;
  }) {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 12;
      const skip = (page - 1) * limit;

      const where: Prisma.ProductWhereInput = {
          shopId: shopId,
          status: 'ACTIVE',
          stock: { gt: 0 }, 
      };

      if (query.categoryId && query.categoryId !== 'all') where.shopCategoryId = query.categoryId;
      if (query.minPrice !== undefined || query.maxPrice !== undefined) {
          where.price = {};
          if (query.minPrice) where.price.gte = Number(query.minPrice);
          if (query.maxPrice) where.price.lte = Number(query.maxPrice);
      }
      if (query.rating) where.rating = { gte: Number(query.rating) };

      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }; 
      switch (query.sort) {
          case 'price_asc': orderBy = { price: 'asc' }; break;
          case 'price_desc': orderBy = { price: 'desc' }; break;
          case 'sales': orderBy = { salesCount: 'desc' }; break;
          case 'rating': orderBy = { rating: 'desc' }; break;
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
      where: { orderId: { in: orderIds }, productId: { not: productId } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 6
    });

    const relatedIds = relatedItems.map(item => item.productId).filter((id): id is string => id !== null);

    if (relatedIds.length > 0) {
        const products = await this.prisma.product.findMany({
            where: { id: { in: relatedIds }, status: 'ACTIVE' },
            include: { options: { include: { values: true } }, variants: true }
        });
        const activeProducts = products.filter(p => p.status === 'ACTIVE' && p.stock > 0);
        await this.redis.set(cacheKey, JSON.stringify(activeProducts), 'EX', 86400);
        return activeProducts;
    }
    return [];
  }

  async getPersonalizedFeed(userId: string, page: number, limit: number) {
    const trackingKey = `user:affinity:${userId}`;
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    let productIds = await this.redis.zrevrange(trackingKey, start, stop);
    if (productIds.length === 0) {
      productIds = await this.redis.zrevrange('global:trending', start, stop);
    }
    const products = await this.productCache.getProductsByIds(productIds);
    return { data: products, meta: { page, limit, total: 100 } };
  }
}