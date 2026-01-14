import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto'; // Bạn tự tạo DTO nhé
import { nanoid } from 'nanoid';
import { generateSlug } from 'src/common/utils/slug.util';
import { Prisma, ShopStatus } from '@prisma/client';

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}

  // 1. Đăng ký Shop mới
  async createShop(userId: string, data: CreateShopDto) {
    // Check xem user đã có shop chưa
    const existingShop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (existingShop) throw new BadRequestException('Bạn đã sở hữu một cửa hàng.');

    // Check trùng tên shop (nếu cần strict)
    // const duplicateName = ...

    // Tạo Slug unique
    const slug = `${generateSlug(data.name)}-${nanoid(6)}`;

    return this.prisma.shop.create({
      data: {
        ownerId: userId,
        name: data.name,
        slug: slug,
        pickupAddress: data.pickupAddress,
        description: data.description,
        status: 'PENDING', // Mặc định chờ duyệt
      }
    });
  }
  async getShopCustomCategories(shopIdOrSlug: string) {
    // [FIX START] Tìm Shop ID thật dựa trên Slug hoặc ID được truyền vào
    let shopId = shopIdOrSlug;
    
    // Kiểm tra xem đây có phải là UUID không (giả sử shopIdOrSlug không phải UUID thì là Slug)
    // Hoặc an toàn nhất là tìm Shop trước
    const shop = await this.prisma.shop.findFirst({
        where: {
            OR: [
                { id: shopIdOrSlug },   // Nếu tham số là UUID
                { slug: shopIdOrSlug }  // Nếu tham số là Slug
            ]
        },
        select: { id: true }
    });

    if (!shop) return []; // Shop không tồn tại
    shopId = shop.id;
    // [FIX END]

    return this.prisma.shopCategory.findMany({
      where: { 
        shopId: shopId, // Sử dụng UUID chuẩn
        isActive: true 
      },
      include: {
        _count: { select: { products: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  // --- 6. [MỚI] Lấy danh mục của Shop ---
  // Logic: Tìm tất cả sản phẩm của Shop -> Lấy ra các Category ID duy nhất -> Trả về thông tin Category
  async getShopCategories(shopId: string) {
    // Cách tối ưu: Dùng distinct của Prisma để lấy unique categoryId
    const distinctCategories = await this.prisma.product.findMany({
      where: {
        shopId: shopId,
        status: 'ACTIVE' // Chỉ lấy danh mục của sp đang bán
      },
      select: {
        category: {
          select: {
            id: true,
            name: true,
            image: true,
            slug: true
          }
        }
      },
      distinct: ['categoryId'] // [QUAN TRỌNG] Loại bỏ trùng lặp
    });

    // Map lại mảng cho gọn (bỏ lớp wrapper 'category')
    return distinctCategories
      .map(item => item.category)
      .filter(cat => cat !== null); // Lọc null phòng hờ
  }

  // --- 7. [MỚI] Lấy sản phẩm của Shop (Search & Filter) ---
  async getShopProducts(shopId: string, params: any) {
    const { 
        page = 1, 
        limit = 12, 
        sort = 'newest', 
        minPrice, 
        maxPrice, 
        categoryId, 
        rating 
    } = params;
    
    const skip = (Number(page) - 1) * Number(limit);

    // 1. Xây dựng điều kiện lọc (Where)
    const where: Prisma.ProductWhereInput = {
      shopId: shopId,
      status: 'ACTIVE',
    };
    
    // [UPDATE] Thêm logic này
    // Nếu params có shopCategoryId (Custom Category của Shop)
    if (params.shopCategoryId) {
        where.shopCategoryId = params.shopCategoryId;
    }
    
    // Giữ nguyên logic categoryId (System Category) cũ
    if (categoryId) {
        where.categoryId = categoryId;
    }

    // Filter theo Giá
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    // Filter theo Rating (Giả sử bạn có trường rating trong Product hoặc tính toán aggregate)
    if (rating) {
      where.rating = { gte: Number(rating) };
    }

    // 2. Xây dựng điều kiện sắp xếp (OrderBy)
    let orderBy: any = { createdAt: 'desc' }; // Default: Mới nhất

    switch (sort) {
        case 'price_asc':
            orderBy = { price: 'asc' };
            break;
        case 'price_desc':
            orderBy = { price: 'desc' };
            break;
        case 'sales':
            orderBy = { salesCount: 'desc' }; // Sắp xếp bán chạy
            break;
        case 'rating':
            orderBy = { rating: 'desc' };
            break;
        default:
            orderBy = { createdAt: 'desc' };
    }

    // 3. Query DB song song (Lấy data + Đếm tổng)
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        take: Number(limit),
        skip,
        orderBy,
        select: {
           // Chọn các trường cần thiết để hiển thị Card Product
           id: true,
           name: true,
           slug: true,
           price: true,
           originalPrice: true,
           images: true,
           rating: true,
           salesCount: true,
           stock: true,
           createdAt: true
        }
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      data: products,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        last_page: Math.ceil(total / Number(limit))
      }
    };
  }

  async getPublicProfile(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        avatar: true,
        coverImage: true,
        description: true,
        rating: true,
        totalSales: true,
        status: true,
        createdAt: true,
        decoration: true,
        // Đếm số lượng sản phẩm
        _count: {
          select: { products: { where: { status: 'ACTIVE' } } }
        }
      }
    });

    if (!shop || shop.status !== ShopStatus.ACTIVE) {
      throw new NotFoundException('Cửa hàng không tồn tại hoặc đã bị khóa');
    }

    return {
       ...shop,
       totalProducts: shop._count.products
    };
  }

  async getShopVouchers(shopId: string) {
    // Lấy voucher ACTIVE và còn hạn
    const now = new Date();
    return this.prisma.voucher.findMany({
      where: {
        shopId: shopId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        usageCount: { lt: this.prisma.voucher.fields.usageLimit } // Chưa hết lượt dùng
      },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        amount: true,
        minOrderValue: true,
        endDate: true
      },
      orderBy: { endDate: 'asc' }
    });
  }

  // 2. Lấy thông tin Shop theo User (Helper quan trọng)
  async getShopByOwnerId(userId: string) {
    if (!userId) {
        console.error("LỖI: userId null/undefined");
        throw new BadRequestException("User ID không hợp lệ.");
    }

    const shop = await this.prisma.shop.findUnique({ 
      where: { ownerId: userId } 
    });
    if (!shop) throw new BadRequestException('Tài khoản này chưa đăng ký Shop');
    return shop;
  }

  // 3. Update Profile
  async updateShopProfile(userId: string, data: any) {
    const shop = await this.getShopByOwnerId(userId);
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...data,
        // Nếu đổi tên shop thì nên regenerate slug hoặc chặn đổi tên
      }
    });
  }

  // 4. Update Decoration (JSON)
  async updateDecoration(userId: string, decoration: any) {
    const shop = await this.getShopByOwnerId(userId);
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: { decoration }
    });
  }

  // 5. Public API: Get Shop By Slug
  async getShopBySlug(slug: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { slug },
      include: {
        products: { take: 10, where: { status: 'ACTIVE' } } // Lấy kèm 10 SP demo
      }
    });
    if (!shop || shop.status !== 'ACTIVE') throw new NotFoundException('Shop không tồn tại hoặc đã bị khóa');
    return shop;
  }
}