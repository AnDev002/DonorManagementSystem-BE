// BE-1.4/modules/product/services/product-cache.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { Product } from '@prisma/client';

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

  // --- 1. LẤY CHI TIẾT SẢN PHẨM ---
  async getProductDetail(id: string): Promise<any | null> {
    // [FIX] Thêm version vào key
    const cacheKey = `product:detail:${CACHE_VERSION}:${id}`;

    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // B. Cache Miss -> Dùng Distributed Lock
    const lockKey = `lock:product:${id}`;
    const acquiredLock = await this.redis.set(lockKey, 'LOCKED', 'EX', TTL.LOCK, 'NX');

    if (acquiredLock === 'OK') {
      try {
        const product = await this.prisma.product.findUnique({ 
            where: { id },
            include: { seller: { select: { name: true, id: true } } } 
        });

        if (product) {
          // Lưu cache (gọi hàm setProductDetail vừa viết thêm bên dưới)
          await this.setProductDetail(id, product);
        } else {
          await this.redis.set(cacheKey, JSON.stringify(null), 'EX', 60);
        }
        return product;
      } finally {
        await this.redis.del(lockKey);
      }
    } else {
      await new Promise(r => setTimeout(r, 200));
      return this.getProductDetail(id);
    }
  }

  // --- [NEW] HÀM BẠN CẦN THÊM VÀO ĐÂY ---
  async setProductDetail(id: string, data: any) {
    const cacheKey = `product:detail:${CACHE_VERSION}:${id}`;
    
    const dataToCache = JSON.stringify(data, (k, v) => 
      typeof v === 'bigint' ? v.toString() : v
    );

    await this.redis.set(cacheKey, dataToCache, 'EX', TTL.PRODUCT_DETAIL);
  }

  // --- 2. LẤY DANH SÁCH THEO ID ---
  async getProductsByIds(ids: string[]): Promise<any[]> {
    if (!ids.length) return [];
    
    const uniqueIds = [...new Set(ids)];
    // [FIX] Dùng key v2
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
        const pipeline = this.redis.pipeline();
        dbProducts.forEach(p => {
          const formatted = { ...p, price: Number(p.price) };
          result.push(formatted);
          
          // Serialize để lưu pipeline
          const dataStr = JSON.stringify(formatted, (k, v) => 
            typeof v === 'bigint' ? v.toString() : v
          );
          
          pipeline.set(`product:detail:${CACHE_VERSION}:${p.id}`, dataStr, 'EX', TTL.PRODUCT_DETAIL);
        });
        await pipeline.exec();
      }
    }

    const resultMap = new Map(result.map(p => [p.id, p]));
    return ids.map(id => resultMap.get(id)).filter(Boolean);
  }

  // --- 3. INVALIDATE ---
  async invalidateProduct(id: string) {
    await this.redis.del(`product:detail:${CACHE_VERSION}:${id}`);
  }
}