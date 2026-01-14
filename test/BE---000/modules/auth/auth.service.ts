// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt'; // Cần cài: pnpm add bcrypt && pnpm add -D @types/bcrypt
import { RegisterDto, LoginDto, VerifyOtpDto, RegisterSellerDto } from './dto/auth.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Role, ShopStatus } from '@prisma/client';
import { UpdateShopProfileDto } from './dto/update-shop.dto';

function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

@Injectable()
export class AuthService {
  // Lưu OTP tạm trong RAM
  private otpStore = new Map<string, { otp: string; expires: number }>();

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  // --- 1. ĐĂNG KÝ (Tạo user + Gửi OTP) ---
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email đã tồn tại');
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Tạo user mới (Chưa verify)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: 'BUYER',
        isVerified: false, // Bắt buộc xác thực OTP
      },
    });
    // Tạo giỏ hàng
    await this.prisma.cart.create({ data: { userId: user.id } });


    if(user.email) {
      // Gửi OTP xác thực
      await this.sendOtp(user.email);
    }
 
    return { message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhập OTP.' };
  }

  async registerSeller(dto: RegisterSellerDto, file: Express.Multer.File) {
    const { email, password, name, shopName, pickupAddress, phoneNumber } = dto;

    // 1. Kiểm tra Email tồn tại
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email đã tồn tại');
    }

    // 2. Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Xử lý File
    const fileUrl = file ? `uploads/${file.filename}` : null; // Logic upload đơn giản

    // 4. Generate Slug cho Shop
    const slug = generateSlug(shopName);
    
    // Check slug trùng (Optional)
    const existingSlug = await this.prisma.shop.findUnique({ where: { slug } });
    if (existingSlug) {
        throw new BadRequestException('Tên Shop đã tồn tại, vui lòng chọn tên khác');
    }

    // 5. Tạo User và Shop trong Transaction để đảm bảo tính toàn vẹn
    // [FIX 3] Sử dụng Role.BUYER và ShopStatus.PENDING như trong lỗi của bạn
    await this.prisma.$transaction(async (tx) => {
        // Tạo User (Mặc định là BUYER, sẽ lên SELLER khi Shop được duyệt)
        const user = await tx.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name,
                role: Role.BUYER, // User ban đầu là Buyer
                isVerified: false,
                phone: phoneNumber, // Đảm bảo schema User có field này
            },
        });

        // Tạo Shop (Trạng thái PENDING)
        await tx.shop.create({
            data: {
                ownerId: user.id,
                name: shopName,
                slug: slug,
                address: pickupAddress,
                licenseImage: fileUrl,
                status: ShopStatus.PENDING, // Chờ duyệt
            }
        });

        // Gửi OTP
        if(email != undefined && email != null && email != "")
        {
          await this.sendOtp(user.email ?? undefined);
        }
    });

    return { message: 'Đăng ký người bán thành công. Vui lòng xác thực OTP.' };
  }

  

  // --- 2. ĐĂNG NHẬP (Check Password + Check Verified) ---
  async login(dto: LoginDto, allowedRoles?: string[]) {
    const user = await this.prisma.user.findFirst({ where: {OR: [{ email: dto.email }, { username: dto.email }]} });
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    if (user.isBanned) {
      throw new UnauthorizedException(`Tài khoản đã bị khóa. Lý do: ${user.banReason}`);
    }
    // 1. Check Password
    if (!user.password) {
        throw new UnauthorizedException('Tài khoản chưa thiết lập mật khẩu.');
    }
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    // 2. Check Verification
    if (!user.isVerified) {
      await this.sendOtp(user.email ?? undefined);
      throw new UnauthorizedException('Tài khoản chưa xác thực. Vui lòng kiểm tra OTP.');
    }

    // 3. CRITICAL: Check Role Permission
    // Hệ thống lớn cần check ngay lúc login để chặn Token được tạo ra cho sai portal
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        throw new UnauthorizedException('Bạn không có quyền truy cập vào khu vực này.');
    }

    // 4. Tạo Token
    return this.generateTokens(user);
  }

  // --- 3. XÁC THỰC OTP (Kích hoạt tài khoản) ---
  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const storedData = this.otpStore.get(normalizedEmail);

    if (!storedData) {
      throw new UnauthorizedException('Mã OTP không tồn tại hoặc đã hết hạn.');
    }

    if (storedData.otp !== dto.otp) {
      throw new UnauthorizedException('Mã OTP không đúng');
    }

    if (Date.now() > storedData.expires) {
      this.otpStore.delete(normalizedEmail);
      throw new UnauthorizedException('Mã OTP đã hết hạn');
    }

    // Xóa OTP
    this.otpStore.delete(normalizedEmail);

    // Cập nhật User thành đã verify
    const user = await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { isVerified: true },
    });

    // Trả về Token để user đăng nhập luôn sau khi nhập OTP thành công
    return this.generateTokens(user);
  }

  // --- HELPER: Gửi OTP (Dùng chung cho Register & Forgot Password) ---
  async sendOtp(email?: string) {
    if(email != "" && email != null && email != undefined)
    {
      const normalizedEmail = email.toLowerCase();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      this.otpStore.set(normalizedEmail, { 
        otp, 
        expires: Date.now() + 5 * 60 * 1000 
      });
  
      console.log(`>>> [DEBUG] OTP cho ${normalizedEmail}: ${otp}`);
  
      try {
        await this.mailerService.sendMail({
          to: normalizedEmail,
          subject: 'Mã xác thực LoveGifts',
          html: `<b>Mã OTP của bạn là: ${otp}</b>. Có hiệu lực trong 5 phút.`,
        });
      } catch (error) {
        console.log('>>> [WARNING] Lỗi gửi mail:', error.message);
      }
    }
  }

  // --- HELPER: Tạo Token (Fix lỗi Property 'generateTokens' does not exist) ---
  private generateTokens(user: any) {
    const payload = { 
        userId: user.id, // Lưu ý: JwtStrategy đang đọc 'userId', giữ nguyên key này
        email: user.email, 
        role: user.role 
    };

    const { password, ...userInfo } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: userInfo 
    };
  }

  async updateShopProfile(userId: string, data: UpdateShopProfileDto) {
    // 1. Tìm Shop của User này
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId }
    });

    if (!shop) {
      throw new NotFoundException('Cửa hàng không tồn tại.');
    }

    // 2. Check trùng tên Shop (nếu có đổi tên và tên khác tên cũ)
    if (data.shopName && data.shopName !== shop.name) {
      // Logic generate slug mới nếu đổi tên (Optional)
      const existingSlug = await this.prisma.shop.findFirst({
        where: { 
            name: data.shopName,
            id: { not: shop.id } // Loại trừ chính nó
        }
      });
      if (existingSlug) {
        throw new ConflictException('Tên Shop đã tồn tại, vui lòng chọn tên khác.');
      }
    }

    // 3. Update Database (Map các trường từ DTO vào Prisma Model)
    // Lưu ý: data.avatar, data.cover... bây giờ là URL string do FE gửi
    const updatedShop = await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        name: data.shopName, // Map shopName -> name
        pickupAddress: data.pickupAddress,
        description: data.description,
        
        // Cập nhật URL ảnh
        avatar: data.avatar,         
        coverImage: data.cover, // Map cover -> coverImage (theo schema Prisma của bạn)

        // Cập nhật Giấy tờ pháp lý
        businessLicenseFront: data.businessLicenseFront,
        businessLicenseBack: data.businessLicenseBack,
        salesLicense: data.salesLicense,
        trademarkCert: data.trademarkCert,
        distributorCert: data.distributorCert,
      },
    });

    // 4. Update Redis Cache (Nếu bạn đang cache thông tin shop/user)
    // const redisKey = `shop_profile:${userId}`;
    // await this.cacheManager.del(redisKey); // Xóa cache cũ để load lại

    return {
      message: 'Cập nhật hồ sơ Shop thành công',
      shop: updatedShop
    };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
            shop: true // Lấy kèm thông tin Shop (chứa giấy tờ, avatar shop...)
        }
    });

    // [FIX] Kiểm tra null trước khi dùng
    if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng'); 
    }

    // Sau khi check null, TypeScript sẽ hiểu user là object hợp lệ
    const { password, ...result } = user;
    return result;
  }
}