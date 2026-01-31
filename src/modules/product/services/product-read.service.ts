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
        const info = await this.redis.call('FT.INFO', INDEX_NAME).catch(() => null);

        if (info) {
            const infoStr = JSON.stringify(info);
            // 1. Kiểm tra Schema cũ
            if (!infoStr.includes('systemTags')) {
                this.logger.warn('⚠️ Old Index Schema detected. Re-creating index...');
                await this.redis.call('FT.DROPINDEX', INDEX_NAME);
                await this.createSearchIndex();
            } else {
                // 2. [AUTO-FIX] Kiểm tra xem dữ liệu có bị "bẩn" (Dirty Data) không?
                // Tìm thử các tag chứa ký tự đặc biệt của URL encoded
                const dirtyCheck: any = await this.redis.call('FT.SEARCH', INDEX_NAME, '@systemTags:{*%*} | @systemTags:{*search*}', 'LIMIT', '0', '1');
                const dirtyCount = dirtyCheck[0] || 0;

                if (dirtyCount > 0) {
                     this.logger.warn(`🚨 Detected ${dirtyCount} items with DIRTY TAGS (URL Encoded). Force Re-syncing...`);
                     await this.syncAllProductsToRedis();
                } else {
                     // 3. Kiểm tra index trống
                     const searchCount: any = await this.redis.call('FT.SEARCH', INDEX_NAME, '*', 'LIMIT', '0', '0');
                     if (Array.isArray(searchCount) && searchCount[0] === 0) {
                         this.logger.warn('⚠️ Index exists but EMPTY. Force syncing data...');
                         await this.syncAllProductsToRedis();
                     } else {
                         this.logger.log('✅ Index check passed & Data looks clean.');
                     }
                }
            }
        } else {
            this.logger.warn('⚠️ Index not found. Creating new Index...');
            await this.createSearchIndex();
        }
    } catch (e: any) {
        this.logger.error(`Init Index Error: ${e.message}`);
    }
  }

  // [CLEANING LOGIC] Làm sạch triệt để tag rác
  private cleanSystemTags(inputTags: any): string {
    let tags: string[] = [];
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
            // Decode 2 lần để chắc chắn (đôi khi bị double encoded)
            try { clean = decodeURIComponent(decodeURIComponent(clean)); } catch {}

            // Xóa prefix rác: /search?q=, ?keyword=...
            clean = clean.replace(/.*(\?|&)(q|keyword)=/, '');
            
            // Xóa ký tự đặc biệt phá vỡ cú pháp Redis TAG, giữ lại dấu gạch ngang (-) và khoảng trắng
            clean = clean.replace(/[{}()\[\]|@!<>"`'\\,]/g, ' '); 

            // Trim và chuẩn hóa khoảng trắng
            return clean.trim().replace(/\s+/g, ' ');
        })
        .filter(t => t.length > 0 && t.length < 50 && !t.includes('http')); // Bỏ tag rỗng hoặc link

    // Join bằng dấu phẩy, không có khoảng trắng thừa
    return Array.from(new Set(cleanedTags)).join(','); 
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
            'systemTags', 'TAG', 'SEPARATOR', ',' 
        );
        this.logger.log('✅ RediSearch Index created');
        this.logger.log('🔄 Auto-syncing products to Redis...');
        await this.syncAllProductsToRedis();
      } catch (e) { }
  }

  async syncAllProductsToRedis() {
    this.logger.log('⏳ Starting Full Product Sync...');
    const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { 
            id: true, name: true, price: true, salesCount: true, 
            status: true, slug: true, images: true, originalPrice: true,
            systemTags: true 
        }
    });

    const pipeline = this.redis.pipeline();
    await this.redis.del(SUGGESTION_KEY);

    for (const p of products) {
        const key = `product:${p.id}`;
        const image = Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as any) : '';
        const tagsString = this.cleanSystemTags(p.systemTags);
        
        const frontendJson = JSON.stringify({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: Number(p.price),
            originalPrice: Number(p.originalPrice || 0),
            images: [image],
            salesCount: p.salesCount || 0,
        });

        pipeline.hset(key, {
            name: p.name,
            price: Number(p.price),
            salesCount: p.salesCount || 0,
            status: p.status,
            id: p.id,
            slug: p.slug,
            json: frontendJson,
            systemTags: tagsString 
        });

        const score = p.salesCount > 0 ? p.salesCount : 1;
        const payload = JSON.stringify({ id: p.id, slug: p.slug, price: Number(p.price), image });
        pipeline.call('FT.SUGADD', SUGGESTION_KEY, p.name, score.toString(), 'PAYLOAD', payload);
    }
    
    await pipeline.exec();
    this.logger.log(`✅ Synced & Cleaned ${products.length} products to Redis`);
    return { count: products.length };
  }

  async syncProductToRedis(product: any) {
    const key = `product:${product.id}`;
    const image = Array.isArray(product.images) && product.images.length > 0 ? (product.images[0] as any) : '';
    const tagsString = this.cleanSystemTags(product.systemTags);

    const frontendJson = JSON.stringify({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        originalPrice: Number(product.originalPrice || 0),
        images: [image],
        salesCount: product.salesCount || 0,
    });

    await this.redis.hset(key, {
      name: product.name,
      price: Number(product.price),
      salesCount: product.salesCount || 0,
      status: product.status,
      id: product.id,
      slug: product.slug,
      json: frontendJson,
      systemTags: tagsString
    });
    
    // Update suggestion
    const score = product.salesCount > 0 ? product.salesCount : 1;
    const payload = JSON.stringify({ id: product.id, slug: product.slug, price: Number(product.price), image });
    await this.redis.call('FT.SUGADD', SUGGESTION_KEY, product.name, score.toString(), 'PAYLOAD', payload);
  }

  // --- QUERY HELPERS ---
  private escapeRediSearchText(str: string): string {
    return str.replace(/([^a-zA-Z0-9\s\u00C0-\u1EF9\-])/g, '\\$1').trim();
  }

  private sanitizeTagKeyword(str: string): string {
      return str.replace(/[{}\|@*()\\\[\]]/g, ' ').trim().replace(/\s+/g, ' ');
  }

  async findAllPublic(query: FindAllPublicDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    // Suggestion Mode
    const isSuggestionMode = limit <= 10 && !query.categorySlug && !query.minPrice && !query.tag;
    if (isSuggestionMode && query.search && query.search.trim().length >= 2) {
        const suggestions = await this.searchSuggestions(query.search);
        if (suggestions.length > 0) {
            return { data: suggestions, meta: { total: suggestions.length, page, limit, last_page: 1 } };
        }
    }

    const queryHash = createHash('md5').update(JSON.stringify(query)).digest('hex');
    const cacheKey = `search:res:${queryHash}`;

    // Cache read
    if ((!query.search || query.search.length < 2) && !query.tag) {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    }

    let resultData: any = null;

    // --- 1. REDIS SEARCH ---
    if ((query.search && query.search.trim().length > 0) || query.tag) {
        try {
            let ftQuery = `@status:{ACTIVE}`;
            const conditions: string[] = [];

            if (query.search && query.search.trim().length > 0) {
                // Name match (Text)
                const cleanName = this.escapeRediSearchText(query.search);
                if (cleanName) {
                    const nameTerms = cleanName.split(/\s+/).map(t => `${t}*`).join(' ');
                    conditions.push(`@name:(${nameTerms})`);
                }

                // Tag match (Exact tag)
                const cleanTagKw = this.sanitizeTagKeyword(query.search);
                if (cleanTagKw) {
                    conditions.push(`@systemTags:{${cleanTagKw}}`);
                }
            }

            if (query.tag) {
                const specificTag = this.sanitizeTagKeyword(query.tag);
                if (specificTag) ftQuery += ` @systemTags:{${specificTag}}`;
            }

            if (conditions.length > 0) {
                ftQuery += ` (${conditions.join(' | ')})`;
            }
            
            if (conditions.length > 0 || query.tag) {
                const searchRes: any = await this.redis.call(
                    'FT.SEARCH', INDEX_NAME, ftQuery,
                    'LIMIT', skip, limit,
                    'SORTBY', 'salesCount', 'DESC', 
                    'RETURN', '1', 'json' 
                );

                if (searchRes[0] > 0) {
                    const products: any[] = [];
                    for (let i = 1; i < searchRes.length; i += 2) {
                        const fields = searchRes[i + 1];
                        if (fields && fields.length >= 2) {
                             const jsonStr = fields[fields.indexOf('json') + 1];
                             if(jsonStr) products.push(JSON.parse(jsonStr));
                        }
                    }
                    resultData = {
                        data: products,
                        meta: { total: searchRes[0], page, limit, last_page: Math.ceil(searchRes[0] / limit) },
                    };
                }
            }
        } catch (e: any) {
            this.logger.error(`Redis Search Failed: ${e.message}`);
        }
    }

    // --- 2. DATABASE FALLBACK (SMART FALLBACK) ---
    if (!resultData) {
        const where: Prisma.ProductWhereInput = {
            status: 'ACTIVE',
            ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
            ...(query.minPrice ? { price: { gte: Number(query.minPrice) } } : {}),
            ...(query.maxPrice ? { price: { lte: Number(query.maxPrice) } } : {}),
            ...(query.brandId ? { brandId: Number(query.brandId) } : {}),
        };

        if (query.search) {
             const cleanSearch = query.search.trim();
             // [IMPORTANT] Tạo phiên bản encoded để tìm những record bị lỗi trong DB
             const encodedSearch = encodeURIComponent(cleanSearch);
             
             where.OR = [
                { name: { contains: cleanSearch } }, // Tìm tên thường
                { systemTags: { string_contains: cleanSearch } }, // Tìm tag thường
                { systemTags: { string_contains: encodedSearch } } // Tìm tag bị lỗi URL encoded (Fix fallback)
             ];
        }
        
        if (query.tag) {
            const cleanTag = query.tag.trim();
            where.systemTags = { 
                // Tìm cả dạng thường và dạng encoded cho tag cụ thể
                string_contains: cleanTag 
            };
        }

        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                take: limit,
                skip: skip,
                orderBy: query.sort === 'price_asc' ? { price: 'asc' } : { salesCount: 'desc' },
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

    if (resultData?.data?.length > 0 && !query.search) {
        await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', 60);
    }
    
    return resultData;
  }

  // --- UTILITY METHODS (Controllers require these) ---

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
    } catch (error) { return []; }
  }

  async findOnePublic(idOrSlug: string) {
    const cachedProduct = await this.productCache.getProductDetail(idOrSlug);
    if (cachedProduct && cachedProduct.status === 'ACTIVE') return cachedProduct;

    const product = await this.prisma.product.findFirst({
      where: { OR: [ { id: idOrSlug }, { slug: { equals: idOrSlug } } ] },
      include: {
        seller: { select: { name: true, id: true, avatar: true } },
        options: { include: { values: { orderBy: { id: 'asc' } } }, orderBy: { position: 'asc' } },
        variants: true,
      },
    });

    if (!product || product.status !== 'ACTIVE') throw new NotFoundException('Sản phẩm không tồn tại');

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
      where: { id: { not: productId }, status: 'ACTIVE', stock: { gt: 0 }, categoryId: currentProduct.categoryId },
      take: 12, orderBy: { salesCount: 'desc' },
      select: { id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true },
    });
  }

  async findShopProducts(shopId: string, query: { page?: number; limit?: number; sort?: string; categoryId?: string; minPrice?: number; maxPrice?: number; rating?: number; }) {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 12;
      const skip = (page - 1) * limit;
      const where: Prisma.ProductWhereInput = { shopId: shopId, status: 'ACTIVE', stock: { gt: 0 } };

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
      return { data: products, meta: { total, page, limit, last_page: Math.ceil(total / limit) } };
  }
  
  async findMoreFromShop(productId: string) {
    const cachedProduct = await this.productCache.getProductDetail(productId);
    let shopId = cachedProduct?.shopId; 
    if (!shopId) {
      const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { shopId: true } });
      shopId = product?.shopId;
    }
    if (!shopId) return [];
    return this.prisma.product.findMany({
      where: { shopId: shopId, id: { not: productId }, status: 'ACTIVE' },
      take: 6, orderBy: { createdAt: 'desc' }, 
      select: { id: true, name: true, price: true, images: true, stock: true, slug: true, rating: true, salesCount: true },
    });
  }

  async findBoughtTogether(productId: string) {
    const cacheKey = `product:bought_together:${productId}`;
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    const orders = await this.prisma.orderItem.findMany({
      where: { productId: productId }, select: { orderId: true }, take: 50, orderBy: { order: { createdAt: 'desc' } }
    });
    const orderIds = orders.map(o => o.orderId);
    if (orderIds.length === 0) return [];

    const relatedItems = await this.prisma.orderItem.groupBy({
      by: ['productId'], where: { orderId: { in: orderIds }, productId: { not: productId } },
      _count: { productId: true }, orderBy: { _count: { productId: 'desc' } }, take: 6
    });
    const relatedIds = relatedItems.map(item => item.productId).filter((id): id is string => id !== null);

    if (relatedIds.length > 0) {
        const products = await this.prisma.product.findMany({
            where: { id: { in: relatedIds }, status: 'ACTIVE' }, include: { options: { include: { values: true } }, variants: true }
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
      select: { id: true, name: true, images: true, variants: true, price: true }, take: 20, 
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
        where, take: limit, skip, orderBy: { createdAt: 'desc' }, include: { variants: true, category: true },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data: products, meta: { total, page, limit, last_page: Math.ceil(total / limit) } };
  }

  async getPersonalizedFeed(userId: string, page: number, limit: number) {
    const start = (page - 1) * limit;
    const stop = start + limit - 1;
    let productIds = await this.redis.zrevrange(`user:affinity:${userId}`, start, stop);
    if (productIds.length === 0) {
      productIds = await this.redis.zrevrange('global:trending', start, stop);
    }
    const products = await this.productCache.getProductsByIds(productIds);
    return { data: products, meta: { page, limit, total: 100 } };
  }
}