import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { Prisma, VoucherScope } from '@prisma/client';

@Injectable()
export class PromotionService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService
  ) {}

  // --- 1. CORE LOGIC: TÍNH TOÁN GIẢM GIÁ ---
  async validateAndCalculateVouchers(
    voucherIds: string[], 
    orderTotal: number,   
    items: any[] 
  ) {
    if (!voucherIds || voucherIds.length === 0) {
      return { totalDiscount: 0, appliedVouchers: [] };
    }

    // Fetch Voucher kèm thông tin Product và Category
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        code: { in: voucherIds },
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      include: { 
        products: { select: { id: true } },
        categories: { select: { id: true } }
      }
    });

    // Lấy thông tin category của sản phẩm trong giỏ
    const productIds = items.map(i => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, categoryId: true }
    });

    let totalDiscount = 0;
    const appliedVouchers: any[] = [];

    for (const voucher of vouchers) {
      let eligibleTotal = 0;

      if (voucher.scope === 'GLOBAL' || voucher.scope === 'SHOP') {
        eligibleTotal = orderTotal;
      } 
      else if (voucher.scope === 'PRODUCT') {
        const validIds = voucher.products.map(p => p.id);
        eligibleTotal = items
          .filter(i => validIds.includes(i.productId))
          .reduce((sum, i) => sum + (i.price * i.quantity), 0);
      } 
      else if (voucher.scope === 'CATEGORY') {
        const validCatIds = voucher.categories.map(c => c.id);
        
        // [FIX] Lọc item thuộc category (Check null an toàn)
        const validItems = items.filter(item => {
          const productInfo = dbProducts.find(p => p.id === item.productId);
          return productInfo && productInfo.categoryId && validCatIds.includes(productInfo.categoryId);
        });

        eligibleTotal = validItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      }

      if (eligibleTotal < Number(voucher.minOrderValue)) continue;

      let amount = 0;
      if (voucher.type === 'FIXED_AMOUNT') {
        amount = Number(voucher.amount);
      } else if (voucher.type === 'PERCENTAGE') {
        amount = (eligibleTotal * Number(voucher.amount)) / 100;
        if (voucher.maxDiscount) {
          amount = Math.min(amount, Number(voucher.maxDiscount));
        }
      }

      totalDiscount += amount;
      appliedVouchers.push(voucher);
    }

    if (totalDiscount > orderTotal) totalDiscount = orderTotal;

    return { totalDiscount, appliedVouchers };
  }

  async getPublicSystemVouchers() {
    const now = new Date();
    return this.prisma.voucher.findMany({
      where: {
        scope: VoucherScope.GLOBAL, // Chỉ lấy voucher toàn sàn
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
      // Có thể include thêm số lượng đã dùng nếu cần hiển thị progress bar
    });
  }

  // --- 2. WRAPPER CHO CONTROLLER ---
  async calculateDiscount(dto: any) {
    const voucherIds = dto.voucherCode ? [dto.voucherCode] : [];
    return this.validateAndCalculateVouchers(voucherIds, dto.total, dto.items || []);
  }

  // --- 3. SELLER: TẠO VOUCHER SHOP ---
  async createShopVoucher(sellerId: string, dto: CreateVoucherDto) {
    // 1. Validate ngày
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // 2. [THÊM MỚI] Kiểm tra mã voucher đã tồn tại chưa
    const existingVoucher = await this.prisma.voucher.findUnique({
      where: { code: dto.code }
    });
    if (existingVoucher) {
      throw new BadRequestException(`Mã voucher '${dto.code}' đã tồn tại. Vui lòng chọn mã khác.`);
    }

    // 3. Validate Scope
    if (dto.scope === VoucherScope.PRODUCT && !dto.productIds?.length) {
        throw new BadRequestException('Vui lòng chọn sản phẩm');
    }
    if (dto.scope === VoucherScope.CATEGORY && !dto.categoryIds?.length) {
        throw new BadRequestException('Vui lòng chọn danh mục');
    }

    return await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          sellerId,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          scope: dto.scope,
          amount: new Prisma.Decimal(dto.amount),
          usageLimit: dto.usageLimit,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          minOrderValue: new Prisma.Decimal(dto.minOrderValue || 0),
          maxDiscount: dto.maxDiscount ? new Prisma.Decimal(dto.maxDiscount) : null,
          
          products: dto.scope === VoucherScope.PRODUCT && dto.productIds ? {
            connect: dto.productIds.map(id => ({ id }))
          } : undefined,

          categories: dto.scope === VoucherScope.CATEGORY && dto.categoryIds ? {
            connect: dto.categoryIds.map(id => ({ id }))
          } : undefined
        }
      });
      
      const stockKey = `voucher:${dto.code}:stock`;
      await this.redisService.set(stockKey, dto.usageLimit.toString());

      return voucher;
    });
  }

  // --- 4. ADMIN: TẠO VOUCHER HỆ THỐNG ---
  async createSystemVoucher(dto: CreateVoucherDto) {
    // 1. Validate ngày
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    // 2. [THÊM MỚI] Kiểm tra trùng mã
    const existingVoucher = await this.prisma.voucher.findUnique({
      where: { code: dto.code }
    });
    if (existingVoucher) {
      throw new BadRequestException(`Mã voucher '${dto.code}' đã tồn tại.`);
    }
    
    // Validate Scope cho Admin
    if (dto.scope === VoucherScope.PRODUCT && !dto.productIds?.length) {
        throw new BadRequestException('Vui lòng chọn sản phẩm áp dụng');
    }
    // Admin cũng có thể tạo voucher theo Category nếu muốn (Logic tương tự)

    return await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          sellerId: null, // Admin
          code: dto.code,
          name: dto.name,
          type: dto.type,
          scope: dto.scope, 
          amount: new Prisma.Decimal(dto.amount),
          usageLimit: dto.usageLimit,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          minOrderValue: new Prisma.Decimal(dto.minOrderValue || 0),
          maxDiscount: dto.maxDiscount ? new Prisma.Decimal(dto.maxDiscount) : null,
          
          products: dto.scope === VoucherScope.PRODUCT && dto.productIds ? {
            connect: dto.productIds.map(id => ({ id }))
          } : undefined,
          
          // Nếu Admin muốn support Category scope thì thêm đoạn này:
          categories: dto.scope === VoucherScope.CATEGORY && dto.categoryIds ? {
            connect: dto.categoryIds.map(id => ({ id }))
          } : undefined
        }
      });

      const stockKey = `voucher:${dto.code}:stock`;
      await this.redisService.set(stockKey, dto.usageLimit.toString());

      return voucher;
    });
  }

  // --- 5. BUYER: CLAIM VOUCHER ---
  async claimVoucher(userId: string, code: string) {
    const stockKey = `voucher:${code}:stock`;
    const usersKey = `voucher:${code}:users`;

    const script = `
      local stock = tonumber(redis.call('GET', KEYS[1]))
      if stock == nil then return -1 end 
      if stock <= 0 then return 0 end    
      if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then return -2 end

      redis.call('DECR', KEYS[1])        
      redis.call('SADD', KEYS[2], ARGV[1]) 
      return 1 
    `;

    const client = this.redisService.getClient();
    const result = await client.eval(script, 2, stockKey, usersKey, userId);

    if (result === -1) throw new BadRequestException('Voucher không tồn tại hoặc chưa bắt đầu');
    if (result === 0) throw new BadRequestException('Voucher đã hết lượt sử dụng');
    if (result === -2) throw new BadRequestException('Bạn đã lưu voucher này rồi');

    const voucher = await this.prisma.voucher.findUnique({ where: { code } });
    if (voucher) {
        await this.prisma.userVoucher.create({
            data: { userId, voucherId: voucher.id }
        }).catch(() => {});
    }

    return { message: 'Lưu voucher thành công!' };
  }

  // --- 6. GETTERS ---
  async getShopVouchers(sellerId: string) {
    return this.prisma.voucher.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { userVouchers: true, orders: true } } }
    });
  }

  async getMyVouchers(userId: string) {
    const userVouchers = await this.prisma.userVoucher.findMany({
      where: { userId, isUsed: false },
      include: { voucher: true },
      orderBy: { createdAt: 'desc' }
    });
    return userVouchers.map(uv => ({ ...uv.voucher, savedAt: uv.createdAt, userVoucherId: uv.id }));
  }

  async getSystemVouchers() {
    return this.prisma.voucher.findMany({
      where: { scope: VoucherScope.GLOBAL },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { userVouchers: true, orders: true } } }
    });
  }

  async getAllVouchers(filter: { scope?: VoucherScope; search?: string }) {
    const where: Prisma.VoucherWhereInput = {};
    if (filter.scope) where.scope = filter.scope;
    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search } },
        { name: { contains: filter.search } }
      ];
    }
    return this.prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, shopName: true } },
        _count: { select: { userVouchers: true, orders: true } }
      }
    });
  }
}