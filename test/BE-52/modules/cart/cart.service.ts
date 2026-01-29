import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants'; // Import từ module vừa tạo
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Injectable()
export class CartService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private prisma: PrismaService,
  ) {}

  private getCartKey(userId: string) {
    return `cart:${userId}`;
  }
  async acquireStock(productId: string, quantity: number): Promise<boolean> {
    const key = `product:stock:${productId}`;
    
    // Lua script: Kiểm tra stock >= quantity thì trừ, trả về 1 (thành công). Ngược lại trả về 0.
    const script = `
      local stock = tonumber(redis.call("get", KEYS[1]))
      if not stock then return -1 end -- Chưa sync stock lên Redis
      if stock >= tonumber(ARGV[1]) then
        redis.call("decrby", KEYS[1], ARGV[1])
        return 1
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, key, quantity);
    
    if (result === -1) {
      // Trường hợp Redis chưa có key stock -> Fallback: Gọi DB lấy stock set vào Redis rồi thử lại (Lazy load)
      // Tạm thời return false để đơn giản hoá, hoặc bạn implement logic sync ở đây.
      return false; 
    }
    
    return result === 1;
  }

  async releaseStock(productId: string, quantity: number) {
      // Trả lại kho nếu tạo đơn thất bại
      await this.redis.incrby(`product:stock:${productId}`, quantity);
  }
  // 1. Thêm vào giỏ (Thao tác Redis - O(1))
  async addToCart(userId: string, dto: AddToCartDto) {
    const key = this.getCartKey(userId);
    
    // HINCRBY: Tăng số lượng item trong hash. Nếu chưa có tự tạo mới.
    // Thao tác này là Atomic trên Redis.
    await this.redis.hincrby(key, dto.productId, dto.quantity);
    
    // Set TTL (Time to live) cho giỏ hàng (ví dụ 7 ngày) để tự dọn dẹp rác
    await this.redis.expire(key, 60 * 60 * 24 * 7);

    return { message: 'Đã cập nhật giỏ hàng (Redis Cache)' };
  }

  // 2. Lấy giỏ hàng (Gộp data từ Redis + Info sản phẩm từ DB)
  async getCart(userId: string) {
    const key = this.getCartKey(userId);
    
    // Lấy toàn bộ item trong hash: { "productId1": "2", "productId2": "5" }
    const cartItemsRaw = await this.redis.hgetall(key);
    const productIds = Object.keys(cartItemsRaw);

    if (productIds.length === 0) {
      return { items: [], total: 0 };
    }

    // Lấy thông tin chi tiết sản phẩm từ DB (chỉ lấy 1 lần)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, images: true, stock: true, slug: true }
    });

    // Map lại dữ liệu để trả về FE
    const items = products.map(p => {
      const quantity = parseInt(cartItemsRaw[p.id]);
      const images = p.images as any[]; 
      return {
        id: p.id, // Ở đây tạm dùng ID sản phẩm làm ID row
        productId: p.id,
        title: p.name,
        imageUrl: Array.isArray(images) ? (images[0]?.url || images[0]) : '',
        price: Number(p.price),
        quantity: quantity,
        stock: p.stock,
        totalPrice: Number(p.price) * quantity
      };
    });

    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return { items, total };
  }

  // 3. Xóa item (Redis HDEL)
  async removeItem(userId: string, productId: string) {
    await this.redis.hdel(this.getCartKey(userId), productId);
    return { success: true };
  }

  // 4. Update số lượng
  async updateQuantity(userId: string, productId: string, quantity: number) {
    if (quantity <= 0) return this.removeItem(userId, productId);
    await this.redis.hset(this.getCartKey(userId), productId, quantity);
    return { success: true };
  }

  // 5. Đồng bộ xuống DB (Dùng khi Checkout hoặc Logout)
  async syncToDatabase(userId: string) {
    const redisCart = await this.redis.hgetall(this.getCartKey(userId));
    if (Object.keys(redisCart).length === 0) return;

    // Sử dụng Transaction của Prisma để insert hàng loạt
    await this.prisma.$transaction(async (tx) => {
        // Tìm hoặc tạo Cart trong DB
        let cart = await tx.cart.findUnique({ where: { userId } });
        if (!cart) cart = await tx.cart.create({ data: { userId } });

        // Loop qua các item trong Redis và upsert vào DB
        for (const [productId, qty] of Object.entries(redisCart)) {
            const quantity = parseInt(qty);
            await tx.cartItem.upsert({
                where: { cartId_productId: { cartId: cart.id, productId } },
                update: { quantity },
                create: { cartId: cart.id, productId, quantity }
            });
        }
    });
    
    // (Tuỳ chọn) Xóa cart trên Redis sau khi sync xong
    // await this.redis.del(this.getCartKey(userId));
  }
  async clearCart(userId: string) {
    const key = this.getCartKey(userId);
    // Xóa key trong Redis -> Thao tác Atomic, rất nhanh
    await this.redis.del(key);
    return { success: true };
  }
}