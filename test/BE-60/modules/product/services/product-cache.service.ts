// File: BE--0033/modules/product/services/product-cache.service.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants';
import { PrismaService } from 'src/database/prisma/prisma.service';

const TTL = {
  PRODUCT_DETAIL: 3600, // 1 giờ
  LOCK: 5,              // 5 giây
};
const CACHE_VERSION = 'v2';

@Injectable()
export class ProductCacheService {
  private readonly logger = new Logger(ProductCacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  // --- 1. LẤY CHI TIẾT SẢN PHẨM (Hỗ trợ cả ID và Slug) ---
  async getProductDetail(idOrSlug: string): Promise<any | null> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    
    // Key cache phân biệt giữa ID và Slug
    const cacheKey = isUUID 
        ? `product:detail:${CACHE_VERSION}:${idOrSlug}`
        : `product:detail:${CACHE_VERSION}:slug:${idOrSlug}`;

    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    return null; // Trả về null để Service bên ngoài gọi DB và set lại cache
  }

  // --- 2. SET CACHE CHI TIẾT ---
  async setProductDetail(id: string, slug: string | null, data: any) {
    const dataToCache = JSON.stringify(data, (k, v) => 
      typeof v === 'bigint' ? v.toString() : v
    );

    const pipeline = this.redis.pipeline();

    // 1. Cache theo ID (Luôn có)
    pipeline.set(`product:detail:${CACHE_VERSION}:${id}`, dataToCache, 'EX', TTL.PRODUCT_DETAIL);

    // 2. Cache theo Slug (Nếu có)
    if (slug) {
        pipeline.set(`product:detail:${CACHE_VERSION}:slug:${slug}`, dataToCache, 'EX', TTL.PRODUCT_DETAIL);
    }

    await pipeline.exec();
  }

  // --- 3. LẤY DANH SÁCH THEO ID (Batch) ---
  async getProductsByIds(ids: string[]): Promise<any[]> {
    if (!ids.length) return [];
    
    const uniqueIds = [...new Set(ids)];
    const cacheKeys = uniqueIds.map(id => `product:detail:${CACHE_VERSION}:${id}`); 

    const cachedResults = await this.redis.mget(cacheKeys);
    
    const result: any[] = [];
    const missingIds: string[] = [];

    cachedResults.forEach((json, index) => {
      if (json) {
        result.push(JSON.parse(json));
      } else {
        missingIds.push(uniqueIds[index]);
      }
    });

    if (missingIds.length > 0) {
      const dbProducts = await this.prisma.product.findMany({
        where: { id: { in: missingIds } },
        include: { seller: { select: { name: true } } }
      });

      if (dbProducts.length > 0) {
        // [FIX] Sử dụng hàm setProductDetail mới để đồng bộ
        await Promise.all(dbProducts.map(p => {
             const formatted = { ...p, price: Number(p.price) };
             result.push(formatted);
             return this.setProductDetail(p.id, p.slug, formatted);
        }));
      }
    }

    const resultMap = new Map(result.map(p => [p.id, p]));
    return ids.map(id => resultMap.get(id)).filter(Boolean);
  }

  // --- 4. INVALIDATE ---
  async invalidateProduct(id: string, slug?: string) {
    const keys = [`product:detail:${CACHE_VERSION}:${id}`];
    if (slug) keys.push(`product:detail:${CACHE_VERSION}:slug:${slug}`);
    await this.redis.del(keys);
  }
}