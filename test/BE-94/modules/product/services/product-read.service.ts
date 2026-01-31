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
             // Force re-sync if needed logic here check
            const infoStr = JSON.stringify(info);
            // Kiểm tra xem schema có đúng chưa, nếu chưa thì drop đi tạo lại
            if (!infoStr.includes('systemTags')) {
                this.logger.warn('⚠️ Old Index Schema detected. Re-creating index...');
                await this.redis.call('FT.DROPINDEX', INDEX_NAME);
                await this.createSearchIndex();
            } else {
                this.logger.log('✅ Index check passed. Ready to search.');
            }
        } else {
            this.logger.warn('⚠️ Index not found. Creating new Index...');
            await this.createSearchIndex();
        }
    } catch (e: any) {
        this.logger.error(`Init Index Error: ${e.message}`);
    }
  }

  // ===========================================================================
  // [FIX 1] DATA CLEANING - Xử lý dữ liệu rác từ Crawler & URL Encoded
  // ===========================================================================
  private cleanSystemTags(inputTags: any): string {
    let tags: string[] = [];

    // 1. Handle Input Variations (String, JSON Array, etc.)
    if (Array.isArray(inputTags)) {
        tags = inputTags;
    } else if (typeof inputTags === 'string') {
        // Trường hợp lưu dưới dạng string "tag1, tag2" hoặc JSON string
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

            // A. Decode URL (Bé%20gái -> Bé gái)
            try { clean = decodeURIComponent(clean); } catch {}

            // B. Xóa Rác URL mạnh tay (Aggressive URL Strip)
            // Loại bỏ tất cả phần domain và query params trước keyword chính
            // Ví dụ: "https://shopee.vn/search?keyword=Áo thun" -> "Áo thun"
            clean = clean.replace(/.*(\?|&)q=/, '').replace(/.*(\?|&)keyword=/, '');
            
            // C. Xóa các ký tự đặc biệt phá vỡ cú pháp Redis TAG
            // Giữ lại: Chữ, Số, Tiếng Việt, Khoảng trắng, Dấu gạch ngang (-) cho range
            // Loại bỏ: { } [ ] ( ) | @ ! < > " ' ` \
            clean = clean.replace(/[{}()\[\]|@!<>"`'\\]/g, ' ');

            // D. Chuẩn hóa khoảng trắng
            return clean.trim().replace(/\s+/g, ' ');
        })
        .filter(t => t.length > 0 && t.length < 50); // Bỏ tag rỗng hoặc quá dài (rác)

    // E. Unique Tags
    return Array.from(new Set(cleanedTags)).join(','); 
  }

  // ===========================================================================
  // [FIX 2] REDIS HELPERS - Tách biệt logic xử lý Text và Tag
  // ===========================================================================
  
  // Helper cho trường TEXT (Name) -> Cần escape các ký tự đặc biệt bằng \
  private escapeRediSearchText(str: string): string {
    return str.replace(/([^a-zA-Z0-9\s\u00C0-\u1EF9\-])/g, '\\$1').trim();
  }

  // Helper cho trường TAG -> KHÔNG dùng \, chỉ loại bỏ ký tự gây lỗi cú pháp {}
  private sanitizeTagKeyword(str: string): string {
      // Chỉ giữ lại ký tự an toàn, thay thế ký tự đặc biệt bằng khoảng trắng
      // Redis TAG query: @field:{ value } -> value không được chứa { } |
      return str.replace(/[{}\|@*()\\\[\]]/g, ' ').trim().replace(/\s+/g, ' ');
  }

  private async createSearchIndex() {
      try {
        await this.redis.call(
            'FT.CREATE', INDEX_NAME, 
            'ON', 'HASH', 
            'PREFIX', '1', 'product:', 
            'SCHEMA', 
            'name', 'TEXT', 'WEIGHT', '5.0', 'SORTABLE', // Tìm kiếm mờ, trọng số cao
            'slug', 'TEXT', 'NOSTEM', 
            'price', 'NUMERIC', 'SORTABLE',
            'salesCount', 'NUMERIC', 'SORTABLE',
            'status', 'TAG',
            'systemTags', 'TAG', 'SEPARATOR', ',' // Quan trọng: TAG separator
        );
        this.logger.log('✅ RediSearch Index created');
        this.logger.log('🔄 Auto-syncing products to Redis...');
        await this.syncAllProductsToRedis();
      } catch (e) {
         // Index already exists, ignore
      }
  }

  async syncAllProductsToRedis() {
    const products = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { 
            id: true, name: true, price: true, salesCount: true, 
            status: true, slug: true, images: true, originalPrice: true,
            systemTags: true 
        }
    });

    const pipeline = this.redis.pipeline();
    // Reset suggestions
    await this.redis.del(SUGGESTION_KEY);

    for (const p of products) {
        const key = `product:${p.id}`;
        const image = Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as any) : '';

        // [APPLY FIX] Clean Data trước khi lưu
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

        // HSET dữ liệu đã sạch vào Redis
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

        // Add to Autocomplete Dictionary
        const score = p.salesCount > 0 ? p.salesCount : 1;
        const payload = JSON.stringify({ id: p.id, slug: p.slug, price: Number(p.price), image });
        pipeline.call('FT.SUGADD', SUGGESTION_KEY, p.name, score.toString(), 'PAYLOAD', payload);
    }
    
    await pipeline.exec();
    this.logger.log(`Synced ${products.length} products to Redis (Cleaned Data)`);
    return { count: products.length };
  }

  async syncProductToRedis(product: any) {
    const key = `product:${product.id}`;
    const image = Array.isArray(product.images) && product.images.length > 0 ? (product.images[0] as any) : '';

    // [APPLY FIX] Clean tags single product
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
    
    const score = product.salesCount > 0 ? product.salesCount : 1;
    const payload = JSON.stringify({ id: product.id, slug: product.slug, price: Number(product.price), image });
    await this.redis.call('FT.SUGADD', SUGGESTION_KEY, product.name, score.toString(), 'PAYLOAD', payload);
  }

  // ===========================================================================
  // [FIX 3] SEARCH LOGIC - Query Builder chuẩn
  // ===========================================================================
  async findAllPublic(query: FindAllPublicDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    // Logic gợi ý (giữ nguyên)
    const isSuggestionMode = limit <= 10 && !query.categorySlug && !query.minPrice && !query.tag;
    if (isSuggestionMode && query.search && query.search.trim().length >= 2) {
        const suggestions = await this.searchSuggestions(query.search);
        if (suggestions.length > 0) {
            return { data: suggestions, meta: { total: suggestions.length, page, limit, last_page: 1 } };
        }
    }

    const queryHash = createHash('md5').update(JSON.stringify(query)).digest('hex');
    const cacheKey = `search:res:${queryHash}`;

    // Chỉ cache nếu không phải search text (vì search text biến thiên quá nhiều)
    if ((!query.search || query.search.length < 2) && !query.tag) {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    }

    let resultData: any = null;

    // --- STRATEGY: Ưu tiên Redis Search ---
    if ((query.search && query.search.trim().length > 0) || query.tag) {
        try {
            // Base filter: Chỉ lấy hàng Active
            let ftQuery = `@status:{ACTIVE}`;
            const conditions: string[] = [];

            if (query.search && query.search.trim().length > 0) {
                // 1. Xử lý tìm kiếm TEXT (Name)
                // Cần escape để tìm chính xác các từ, thêm * cho prefix match
                const cleanName = this.escapeRediSearchText(query.search);
                if (cleanName) {
                    // "Ao thun" -> "Ao* thun*"
                    const nameTokens = cleanName.split(/\s+/).map(t => `${t}*`).join(' ');
                    conditions.push(`@name:(${nameTokens})`);
                }

                // 2. Xử lý tìm kiếm TAG (SystemTags)
                // KHÔNG escape, chỉ sanitize ký tự đặc biệt
                const cleanTagKw = this.sanitizeTagKeyword(query.search);
                if (cleanTagKw) {
                    // Tìm chính xác cụm từ trong tags: {Ao thun}
                    conditions.push(`@systemTags:{${cleanTagKw}}`);
                    
                    // Nếu keyword có nhiều từ, thử tìm từng từ trong tag (Optional, tăng khả năng hit)
                    // Ví dụ: User gõ "Bé gái", tìm tag "Bé" hoặc tag "gái"
                    // const tagTokens = cleanTagKw.split(/\s+/).filter(t => t.length > 1);
                    // if (tagTokens.length > 0) {
                    //    conditions.push(`@systemTags:{${tagTokens.join(' | ')}}`);
                    // }
                }
            }

            // 3. Filter theo Tag cụ thể (nếu có tham số ?tag=...)
            if (query.tag) {
                const specificTag = this.sanitizeTagKeyword(query.tag);
                if (specificTag) {
                    ftQuery += ` @systemTags:{${specificTag}}`;
                }
            }

            // Combine logic: (Name match OR Tag match) AND Status Active
            if (conditions.length > 0) {
                ftQuery += ` (${conditions.join(' | ')})`;
            }
            
            // Execute Query nếu có điều kiện tìm kiếm
            if (conditions.length > 0 || query.tag) {
                // Debug log để kiểm tra câu query cuối cùng
                // this.logger.debug(`FT.SEARCH QUERY: ${ftQuery}`); 

                const searchRes: any = await this.redis.call(
                    'FT.SEARCH', INDEX_NAME, 
                    ftQuery,
                    'LIMIT', skip, limit,
                    'SORTBY', 'salesCount', 'DESC', 
                    'RETURN', '1', 'json' 
                );

                const total = searchRes[0];
                if (total > 0) {
                    const products: any[] = [];
                    // Parse kết quả từ JSON string
                    for (let i = 1; i < searchRes.length; i += 2) {
                        const fields = searchRes[i + 1];
                        // Kết quả trả về dạng [key, value, key, value...]
                        // Ở đây chúng ta request 'json' nên nó nằm ở fields[1]
                        if (fields && fields.length >= 2) {
                             // Đôi khi redis trả về tên field ở index chẵn, value ở index lẻ
                             const jsonStr = fields[fields.indexOf('json') + 1];
                             if(jsonStr) products.push(JSON.parse(jsonStr));
                        }
                    }
                    resultData = {
                        data: products,
                        meta: { total, page, limit, last_page: Math.ceil(total / limit) },
                    };
                }
            }
        } catch (e: any) {
            this.logger.error(`RediSearch Query Error: ${e.message} | Query: ${query.search}`);
            // Fallthrough to DB fallback intentionally
        }
    }

    // --- DB FALLBACK (Nếu Redis lỗi, không có kết quả, hoặc filter phức tạp chưa index) ---
    if (!resultData) {
        const where: Prisma.ProductWhereInput = {
            status: 'ACTIVE',
            ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
            ...(query.minPrice ? { price: { gte: Number(query.minPrice) } } : {}),
            ...(query.maxPrice ? { price: { lte: Number(query.maxPrice) } } : {}),
            ...(query.brandId ? { brandId: Number(query.brandId) } : {}),
        };

        // Logic search DB (chậm hơn nhưng chắc chắn)
        if (query.search) {
             where.OR = [
                { name: { contains: query.search.trim() } },
                { systemTags: { string_contains: query.search.trim() } } // Prisma string contains
             ];
        }
        
        if (query.tag) {
            where.systemTags = { string_contains: query.tag };
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

    // Cache kết quả DB (không cache kết quả search text để tiết kiệm mem)
    if (resultData?.data?.length > 0 && !query.search) {
        await this.redis.set(cacheKey, JSON.stringify(resultData), 'EX', 60);
    }
    
    return resultData;
  }

  // ===========================================================================
  // Các hàm phụ trợ giữ nguyên logic business
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
    // Basic implementation placeholder to match previous file structure
    const trackingKey = `user:affinity:${userId}`;
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    let productIds = await this.redis.zrevrange(trackingKey, start, stop);
    if (productIds.length === 0) {
      productIds = await this.redis.zrevrange('global:trending', start, stop);
    }
    // Note: Assuming productCache.getProductsByIds exists as per original file
    const products = await this.productCache.getProductsByIds(productIds);
    return { data: products, meta: { page, limit, total: 100 } };
  }
}