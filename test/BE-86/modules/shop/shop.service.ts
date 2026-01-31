import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto'; // Bạn tự tạo DTO nhé
import { nanoid } from 'nanoid';
import { generateSlug } from 'src/common/utils/slug.util';
import { Prisma, ShopStatus } from '@prisma/client';
import { UpdateShopProfileDto } from '../auth/dto/update-shop.dto';

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}
  private async resolveShopId(idOrSlug: string): Promise<string | null> {
    const shop = await this.prisma.shop.findFirst({
      where: {
        OR: [
          { id: idOrSlug },    // Trường hợp tham số là UUID
          { slug: idOrSlug }   // Trường hợp tham số là Slug
        ]
      },
      select: { id: true }
    });
    return shop ? shop.id : null;
  }
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
        provinceId: data.provinceId,
        districtId: data.districtId,
        wardCode: data.wardCode,
        lat: data.lat || 0,
        lng: data.lng || 0,
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
  async getShopProducts(shopIdOrSlug: string, params: any) {
    // 1. Resolve ID thật sự trước khi query Product
    const shopId = await this.resolveShopId(shopIdOrSlug);
    
    // Nếu không tìm thấy Shop, trả về danh sách rỗng thay vì lỗi
    if (!shopId) {
        return { 
          data: [], 
          meta: { 
            total: 0, 
            page: 1, 
            limit: Number(params.limit) || 12, 
            last_page: 0 
          } 
        };
    }

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

    // 2. Xây dựng điều kiện lọc (Where)
    const where: Prisma.ProductWhereInput = {
      shopId: shopId, // Sử dụng shopId chuẩn (UUID) đã tìm được ở trên
      status: 'ACTIVE',
    };
    
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

    // Filter theo Rating
    if (rating) {
      where.rating = { gte: Number(rating) };
    }

    // 3. Xây dựng điều kiện sắp xếp (OrderBy)
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

    // 4. Query DB song song (Lấy data + Đếm tổng)
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

  async getPublicProfile(idOrSlug: string) {
    // 1. Tìm shop linh hoạt (ID hoặc Slug)
    const shop = await this.prisma.shop.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug }
        ]
      },
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
        _count: {
          select: { products: { where: { status: 'ACTIVE' } } }
        }
      }
    });

    // 2. Kiểm tra trạng thái
    if (!shop /* || shop.status !== ShopStatus.ACTIVE */) {
      throw new NotFoundException('Cửa hàng không tồn tại hoặc đã bị khóa');
    }

    // if (shop.status === 'BANNED') {
    //     throw new NotFoundException('Cửa hàng đã bị khóa');
    // }

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
  async updateShopProfile(userId: string, data: UpdateShopProfileDto) {
    const shop = await this.getShopByOwnerId(userId);

    // Tách dữ liệu: Thông tin cơ bản (update ngay) và Giấy tờ (cần duyệt)
    const basicInfo: any = {};
    const sensitiveInfo: any = {};

    // Map dữ liệu từ DTO
    if (data.shopName) basicInfo.name = data.shopName;
    if (data.pickupAddress) basicInfo.pickupAddress = data.pickupAddress;
    if (data.description) basicInfo.description = data.description;
    if (data.avatar) basicInfo.avatar = data.avatar;
    if (data.cover) basicInfo.coverImage = data.cover;

    // Các giấy tờ cần duyệt
    if (data.businessLicenseFront) sensitiveInfo.businessLicenseFront = data.businessLicenseFront;
    if (data.businessLicenseBack) sensitiveInfo.businessLicenseBack = data.businessLicenseBack;
    if (data.salesLicense) sensitiveInfo.salesLicense = data.salesLicense;
    if (data.trademarkCert) sensitiveInfo.trademarkCert = data.trademarkCert;
    if (data.distributorCert) sensitiveInfo.distributorCert = data.distributorCert;

    const updateData: any = { ...basicInfo };

    // Nếu có thay đổi giấy tờ, lưu vào pendingDetails (merge với cái cũ nếu có)
    if (Object.keys(sensitiveInfo).length > 0) {
      const currentPending = (shop.pendingDetails as any) || {};
      updateData.pendingDetails = {
        ...currentPending,
        ...sensitiveInfo,
        updatedAt: new Date() // Đánh dấu thời gian update
      };
      // Có thể bắn noti cho Admin biết có yêu cầu duyệt mới tại đây
    }

    const updatedShop = await this.prisma.shop.update({
      where: { id: shop.id },
      data: updateData,
    });

    // [QUAN TRỌNG] Trả về Shop data (merge pending để FE hiển thị trạng thái "Đang chờ")
    return updatedShop;
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