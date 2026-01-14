import { Body, Controller, Post, Get, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, Put, UploadedFiles, Res } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginDto, RegisterDto, RegisterSellerDto, SendOtpDto, VerifyOtpDto } from '../dto/auth.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { Role } from '@prisma/client';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { Response } from 'express';
import { UpdateShopProfileDto } from '../dto/update-shop.dto';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAuthCookie(res: Response, token: string) {
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: true, // BẮT BUỘC true khi dùng sameSite: 'none'
      sameSite: 'none', // QUAN TRỌNG: Cho phép gửi cookie cross-site (FE -> BE)
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('register/seller')
  @UseInterceptors(FileInterceptor('licenseDocument')) // 'licenseDocument' phải trùng với key formData ở FE
  async registerSeller(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: RegisterSellerDto // Sử dụng DTO chuẩn
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên giấy phép kinh doanh/CCCD');
    }
    return this.authService.registerSeller(body, file);
  }

  // 2. Đăng nhập (Email + Pass)@Public()
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response // Inject Response
  ) {
    // Cho phép BUYER, SELLER, ADMIN đều login được ở trang khách (tùy nghiệp vụ)
    const data = await this.authService.login(dto, [Role.BUYER, Role.SELLER, Role.ADMIN]);
    
    // Set Cookie
    this.setAuthCookie(res, data.access_token);

    // Chỉ trả về user, KHÔNG trả token trong body
    return { user: data.user };
  }

  // 2. Đăng nhập dành riêng cho Seller Dashboard
  @Public()
  @Post('login/seller')
  async loginSeller(
    @Body() dto: LoginDto, 
    @Res({ passthrough: true }) res: Response
  ) {
      const data = await this.authService.login(dto, [Role.SELLER, Role.ADMIN]);

      res.cookie('accessToken', data.access_token, {
        httpOnly: true,
        secure: true, // BẮT BUỘC true
        sameSite: 'none', // QUAN TRỌNG: Sửa từ 'strict' thành 'none'
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return { user: data.user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    return { message: 'Đăng xuất thành công' };
  }

  // 3. Đăng nhập dành riêng cho Admin Portal
  @Public()
  @Post('login/admin')
  async loginAdmin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const data = await this.authService.login(dto, [Role.ADMIN]);
    this.setAuthCookie(res, data.access_token);
    return { user: data.user };
  }

  @Public()
  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    await this.authService.sendOtp(dto.email);
    return { message: 'Đã gửi lại mã OTP' };
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER')
  @Put('seller/profile') // Route: PUT /auth/seller/profile
  async updateShopProfile(
    @User() user: any,
    @Body() body: UpdateShopProfileDto, // Chỉ nhận JSON body
  ) {
    // Không cần xử lý file ở đây nữa, gọi thẳng service
    return this.authService.updateShopProfile(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@User() user: any) {
    // Gọi xuống service để findUnique lấy full thông tin mới nhất từ DB
    // Vì thông tin trong token (request.user) có thể bị cũ
    return this.authService.getUserProfile(user.id);
  }
}