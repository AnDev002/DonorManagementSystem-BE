import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateBannerDto, UpdateBannerDto, ReorderBannersDto, SaveConfigDto } from './dto/content.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // ================= PUBLIC ROUTES =================
  
  // FE: apiClient.get('/content/banners', { params: { location } })
  @Public()
  @Get('banners')
  async getBanners(@Query('location') location: string) {
    return this.contentService.getBanners(location);
  }

  // FE: apiClient.get(`/content/config/${key}`)
  @Public()
  @Get('config/:key')
  async getConfig(@Param('key') key: string) {
    return this.contentService.getConfig(key);
  }

  // ================= ADMIN ROUTES =================
  // Yêu cầu quyền ADMIN cho các thao tác ghi

  // FE: apiClient.get('/content/admin/banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/banners')
  async getAllBannersAdmin() {
    return this.contentService.getAllBannersAdmin();
  }

  // FE: apiClient.post('/content/admin/banners', data)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/banners')
  async createBanner(@Body() dto: CreateBannerDto) {
    return this.contentService.createBanner(dto);
  }

  // FE: apiClient.patch('/content/admin/banners/reorder', items)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/banners/reorder')
  async reorderBanners(@Body() body: ReorderBannersDto) {
    // Lưu ý: FE gửi mảng items trực tiếp hay object { items: [...] }?
    // Trong ContentService FE bạn viết: apiClient.patch(..., items) -> items là mảng.
    // NestJS Body sẽ nhận toàn bộ body. Nếu FE gửi mảng trực tiếp: @Body() items: {id, order}[]
    // Tốt nhất ở FE nên gửi: { items: [...] }. 
    // Tuy nhiên để khớp code FE hiện tại (gửi items là mảng object):
    return this.contentService.reorderBanners(body as any); 
  }

  // FE: apiClient.patch(`/content/admin/banners/${id}`, data)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/banners/:id')
  async updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.contentService.updateBanner(id, dto);
  }

  // FE: apiClient.delete(`/content/admin/banners/${id}`)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('admin/banners/:id')
  async deleteBanner(@Param('id') id: string) {
    return this.contentService.deleteBanner(id);
  }

  // FE: apiClient.post('/content/admin/config', { key, value })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/config')
  async saveConfig(@Body() dto: SaveConfigDto) {
    return this.contentService.saveConfig(dto);
  }
}