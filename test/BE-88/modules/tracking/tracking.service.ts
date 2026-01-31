import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants';
import { Redis } from 'ioredis';
import { TrackEventDto, EventType } from './dto/track-event.dto';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly STREAM_KEY = 'tracking_stream';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // 1. Đẩy event vào Stream
  async trackEvent(userId: string | null, guestId: string, dto: TrackEventDto) {
    const payload = JSON.stringify({
      userId,
      guestId,
      ...dto,
      serverTimestamp: Date.now(),
    });

    try {
      // MAXLEN ~ 1 triệu: Giữ stream đủ dài để worker xử lý kịp, tự động cắt cũ
      await this.redis.xadd(this.STREAM_KEY, 'MAXLEN', '~', 1000000, '*', 'data', payload);
    } catch (e) {
      this.logger.error(`Failed to push to stream: ${e.message}`);
    }
  }

  // 2. Merge Data: Guest -> User
  async mergeGuestData(guestId: string, realUserId: string) {
    const guestKey = `user:affinity:guest:${guestId}`;
    const userKey = `user:affinity:${realUserId}`;

    const exists = await this.redis.exists(guestKey);
    if (exists) {
      this.logger.log(`🔄 Merging data: Guest[${guestId}] -> User[${realUserId}]`);
      // ZUNIONSTORE: Gộp điểm từ Guest vào User, lấy MAX score hoặc SUM tùy strategy
      await this.redis.zunionstore(userKey, 2, userKey, guestKey, 'WEIGHTS', 1, 1, 'AGGREGATE', 'MAX');
      await this.redis.del(guestKey); 
      await this.redis.expire(userKey, 60 * 60 * 24 * 60); // 60 ngày
    }
  }

  // 3. Scoring System (Hệ thống chấm điểm hành vi)
  async updateAffinityScore(payload: any) {
      if (!payload.targetId || payload.targetId === 'none') return;

      const SCORES: Record<string, number> = {
          [EventType.VIEW_PRODUCT]: 1,
          [EventType.CLICK_PRODUCT]: 2,
          [EventType.ADD_TO_CART]: 5,
          [EventType.BEGIN_CHECKOUT]: 10,
          [EventType.PURCHASE]: 50,
      };

      const score = SCORES[payload.type] || 0;
      if (score === 0) return;

      const identifier = payload.userId 
        ? `user:affinity:${payload.userId}` 
        : `user:affinity:guest:${payload.guestId}`;
      
      // Nếu là Mua hàng -> Cộng điểm cho tất cả sản phẩm trong đơn
      if (payload.type === EventType.PURCHASE && payload.metadata?.items) {
          const items = payload.metadata.items; 
          if (Array.isArray(items)) {
             const pipeline = this.redis.pipeline();
             items.forEach((item: any) => {
                 if (item.productId) {
                    pipeline.zincrby(identifier, score, item.productId);
                 }
             });
             pipeline.expire(identifier, 60 * 60 * 24 * 60);
             await pipeline.exec();
          }
      } else {
          // Cộng điểm cho 1 item
          await this.redis.zincrby(identifier, score, payload.targetId);
          await this.redis.expire(identifier, 60 * 60 * 24 * 60);
      }
  }

  // 4. Recommendation Engine
  async getRecommendations(userId: string | null, guestId: string): Promise<string[]> {
    const key = userId ? `user:affinity:${userId}` : `user:affinity:guest:${guestId}`;
    
    // Lấy top 20 sản phẩm quan tâm nhất
    let productIds = await this.redis.zrevrange(key, 0, 19);
    
    // Fallback: Global Trending
    if (productIds.length < 10) {
        const trendingIds = await this.redis.zrevrange('global:trending', 0, 19);
        productIds = Array.from(new Set([...productIds, ...trendingIds]));
    }

    return productIds.slice(0, 20);
  }
}