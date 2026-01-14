import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { EventType } from '../tracking/dto/track-event.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { Prisma, Role, ShopStatus } from '@prisma/client';
import { CreateUserDto } from './dto/admin-users.dto';
import * as bcrypt from 'bcrypt';
@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
    private mailerService: MailerService,
  ) {}

  // =================================================================
  // 1. QUẢN LÝ SHOP (SELLERS) - Đã chuyển sang Model SHOP
  // =================================================================

  async getSellers(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 10, search } = params;
    const skip = (page - 1) * limit;

    // Điều kiện lọc cho Shop
    const where: Prisma.ShopWhereInput = {
      // Lấy tất cả shop (Trừ shop đang chờ duyệt nếu muốn tách riêng trang approval)
      // status: { not: ShopStatus.PENDING } 
    };

    if (search) {
      where.OR = [
        { name: { contains: search } }, // Tên Shop
        { owner: { email: { contains: search } } }, // Email chủ shop
        { owner: { name: { contains: search } } }, // Tên chủ shop
      ];
    }

    // [QUERY CHÍNH] Lấy danh sách Shop từ bảng Shop
    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { // Include thông tin chủ shop để hiển thị
            select: { 
              id: true, 
              email: true, 
              name: true, 
              phone: true, 
              avatar: true, 
              walletBalance: true // Ví tiền vẫn nằm ở User
            }
          },
          _count: { select: { products: true } } // Đếm sản phẩm
        },
      }),
      this.prisma.shop.count({ where }),
    ]);

    // Tính toán doanh thu (Revenue) dựa trên bảng OrderItem -> Product -> Shop
    const data = await Promise.all(shops.map(async (shop) => {
      // Tính tổng tiền từ các đơn hàng đã giao thành công (DELIVERED)
      // Logic: OrderItem liên kết với Product, Product liên kết với Shop
      const revenueStats = await this.prisma.orderItem.findMany({
        where: {
          product: { shopId: shop.id }, // [QUAN TRỌNG] Filter theo shopId
          order: { status: 'DELIVERED' }
        },
        select: { price: true, quantity: true }
      });

      const totalRevenue = revenueStats.reduce((sum, item) => {
        return sum + (Number(item.price) * item.quantity);
      }, 0);

      // Đếm số đơn hàng thành công
      const totalOrders = await this.prisma.order.count({
        where: {
          status: 'DELIVERED',
          items: { some: { product: { shopId: shop.id } } }
        }
      });

      // Map dữ liệu phẳng ra để Frontend dễ dùng (giống cấu trúc cũ)
      return {
        id: shop.id,                 // ID của Shop
        shopName: shop.name,         // Tên Shop
        avatar: shop.avatar || shop.owner.avatar,
        createdAt: shop.createdAt,
        status: shop.status,         // ACTIVE, BANNED, PENDING...
        isBanned: shop.status === 'BANNED',
        
        // Thông tin Owner
        ownerId: shop.owner.id,
        name: shop.owner.name,       // Tên chủ shop
        email: shop.owner.email,
        phone: shop.owner.phone,
        walletBalance: shop.owner.walletBalance,

        // Chỉ số
        totalRevenue,
        totalOrders,
        totalProducts: shop._count.products,
        rating: shop.rating || 0
      };
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // --- [UPDATE] Hàm Khóa/Mở khóa Shop (Thao tác trên Shop Model) ---
  async toggleBanShop(adminId: string, shopId: string, isBanned: boolean, reason?: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Cửa hàng không tồn tại');

    // Cập nhật trạng thái Shop
    await this.prisma.shop.update({
      where: { id: shopId },
      data: { 
        status: isBanned ? ShopStatus.BANNED : ShopStatus.ACTIVE,
        banReason: isBanned ? reason : null 
      }
    });

    // Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: isBanned ? EventType.BAN_SHOP : EventType.UNBAN_SHOP,
      targetId: shopId,
      metadata: { reason, shopName: shop.name }
    });

    return { 
      success: true, 
      message: isBanned ? `Đã khóa shop ${shop.name}` : `Đã mở khóa shop ${shop.name}` 
    };
  }

  // --- [UPDATE] Lấy danh sách Shop chờ duyệt ---
  async getPendingShops(page: number = 1, limit: number = 10) {
    console.log(`🔍 [DEBUG] getPendingShops called with page=${page}, limit=${limit}`); // <--- LOG 1
    
    const skip = (page - 1) * limit;
    
    // Kiểm tra xem có bao nhiêu shop đang pending trong DB
    const pendingCount = await this.prisma.shop.count({ where: { status: 'PENDING' } });
    console.log(`📊 [DEBUG] Total PENDING shops found in DB: ${pendingCount}`); // <--- LOG 2

    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        where: { status: 'PENDING' }, // Tìm Shop PENDING, không phải User PENDING_SELLER
        include: {
          owner: { select: { email: true, name: true, phone: true } }
        },
        orderBy: { createdAt: 'asc' }, 
        skip,
        take: limit,
      }),
      this.prisma.shop.count({ where: { status: 'PENDING' } }),
    ]);

    console.log(`✅ [DEBUG] Returning ${shops.length} shops to Controller`); // <--- LOG 3

    return {
      data: shops,
      meta: { total, page, lastPage: Math.ceil(total / limit) }
    };
  }
  
  // --- [UPDATE] Duyệt Shop ---
  async approveShop(adminId: string, shopId: string) {
    // Include owner để lấy email gửi thông báo
    const shop = await this.prisma.shop.findUnique({ 
        where: { id: shopId },
        include: { owner: true } 
    });

    if (!shop) throw new NotFoundException('Shop không tồn tại');
    if (shop.status === 'ACTIVE') throw new BadRequestException('Shop này đã được duyệt rồi');

    // 1. Cập nhật trạng thái Shop -> ACTIVE
    await this.prisma.shop.update({
      where: { id: shopId },
      data: { status: ShopStatus.ACTIVE },
    });

    // 2. Cập nhật Role cho User -> SELLER (nếu chưa phải)
    // Để họ có quyền truy cập vào các API seller
    if (shop.owner.role !== 'SELLER') {
        await this.prisma.user.update({
            where: { id: shop.ownerId },
            data: { role: 'SELLER', isVerified: true }
        });
    }
    if(shop.owner.email)
    {
      // 3. Gửi Email thông báo
      try {
          await this.mailerService.sendMail({
              to: shop.owner.email,
              subject: 'Chúc mừng! Cửa hàng của bạn đã được duyệt trên LoveGifts',
              html: `
                  <h3>Xin chào ${shop.owner.name},</h3>
                  <p>Cửa hàng <b>${shop.name}</b> của bạn đã được phê duyệt.</p>
                  <p>Bạn có thể bắt đầu đăng bán sản phẩm ngay bây giờ.</p>
              `,
          });
      } catch (error) {
          console.error("Lỗi gửi mail approve shop:", error.message);
      }
    }

    // 4. Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: EventType.APPROVE_SELLER, // Hoặc tạo thêm EventType.APPROVE_SHOP
      targetId: shopId,
      metadata: { adminId, action: 'Approve Shop', timestamp: new Date() }
    });

    return { message: 'Đã phê duyệt Shop thành công' };
  }

  // --- [UPDATE] Từ chối Shop ---
  async rejectShop(adminId: string, shopId: string, reason?: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop không tồn tại');

    // Cập nhật trạng thái -> REJECTED
    await this.prisma.shop.update({ 
        where: { id: shopId }, 
        data: { 
            status: ShopStatus.REJECTED,
            banReason: reason
        } 
    });

    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: EventType.REJECT_SELLER,
      targetId: shopId,
      metadata: { reason }
    });

    return { message: 'Đã từ chối yêu cầu mở Shop' };
  }

  // =================================================================
  // 2. QUẢN LÝ USER (Người dùng thường)
  // =================================================================

  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) {
    const { page = 1, limit = 10, search, role } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role && role !== 'ALL') {
      where.role = role as Role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { username: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          phone: true,
          role: true,
          avatar: true,
          isVerified: true,
          isBanned: true, // Lấy trạng thái khóa User
          banReason: true,
          createdAt: true,
          // Include Shop để biết user này có shop không
          shop: {
            select: { id: true, name: true, status: true }
          }
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createUser(adminId: string, dto: CreateUserDto) {
    // 1. Validate: Phải có ít nhất Email hoặc Username
    if (!dto.email && !dto.username) {
      throw new BadRequestException('Phải cung cấp Email hoặc Username');
    }

    // 2. Check trùng lặp
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : {},
          dto.username ? { username: dto.username } : {}
        ]
      }
    });

    if (existingUser) {
      throw new ConflictException('Email hoặc Username đã tồn tại trong hệ thống');
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 4. Tạo User
    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email || null,       // Có thể null
        username: dto.username || null, // Có thể null
        password: hashedPassword,
        role: dto.role || Role.BUYER,
        isVerified: true, // Admin tạo thì mặc định đã xác thực
        cart: { create: {} } // Tạo luôn giỏ hàng
      }
    });

    // 5. Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: EventType.CREATE_USER, // Cần thêm vào Enum EventType nếu chưa có
      targetId: newUser.id,
      metadata: { username: newUser.username, email: newUser.email }
    });

    const { password, ...result } = newUser;
    return result;
  }

  async toggleBanUser(adminId: string, userId: string, isBanned: boolean, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    // Không cho phép khóa Admin khác (để an toàn)
    if (user.role === 'ADMIN' && isBanned) {
      throw new BadRequestException('Không thể khóa tài khoản Admin');
    }

    // Update trạng thái
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: isBanned,
        banReason: isBanned ? reason : null // Nếu mở khóa thì xóa lý do
      }
    });

    // Nếu khóa User -> Cần xem xét khóa luôn Shop của họ (nếu có)
    if (isBanned && user.role === 'SELLER') {
       await this.prisma.shop.updateMany({
         where: { ownerId: userId },
         data: { status: 'BANNED', banReason: 'Tài khoản chủ sở hữu bị khóa: ' + reason }
       });
    }

    // Tracking
    await this.trackingService.trackEvent(adminId, 'admin-action', {
      type: isBanned ? EventType.BAN_USER : EventType.UNBAN_USER, // Cần thêm vào Enum EventType
      targetId: userId,
      metadata: { reason, email: user.email }
    });

    return {
      success: true,
      message: isBanned 
        ? `Đã khóa tài khoản ${user.name}` 
        : `Đã mở khóa tài khoản ${user.name}`,
      user: { id: updatedUser.id, isBanned: updatedUser.isBanned }
    };
  }
}