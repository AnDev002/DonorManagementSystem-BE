import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { HomeSettingsService } from './home-settings.service';
import { Roles } from '../../common/decorators/roles.decorator'; // Decorator phân quyền của bạn
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('home-settings')
export class HomeSettingsController {
  constructor(private readonly homeSettingsService: HomeSettingsService) {}

  // 1. API Public cho Homepage (Ai cũng gọi được)
  @Public()
  @Get('layout')
  getPublicLayout() {
    return this.homeSettingsService.getHomeLayout();
  }

  // 2. API Admin: Lấy danh sách quản lý
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllForAdmin() {
    return this.homeSettingsService.getAllSections();
  }

  // 3. API Admin: Tạo mới
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() data: any) {
    return this.homeSettingsService.createSection(data);
  }

  // 4. API Admin: Sắp xếp thứ tự (Kéo thả)
  @Post('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  reorder(@Body() body: { ids: string[] }) {
    return this.homeSettingsService.reorderSections(body.ids);
  }

  // 5. API Admin: Cập nhật
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() data: any) {
    return this.homeSettingsService.updateSection(id, data);
  }

  // 6. API Admin: Xóa
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.homeSettingsService.deleteSection(id);
  }
}