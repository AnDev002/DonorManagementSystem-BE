import { 
  Controller, Get, Post, Body, Put, Param, Delete, Query, ParseIntPipe, Patch, UseGuards 
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  // --- Public/Seller Routes (Prefix: /brands) ---
  @Get('brands')
  @Public() // Accessible by Sellers & Public
  async getActiveBrands() {
    return this.brandService.findAllActive();
  }

  // --- Admin Routes (Prefix: /admin/brands) ---
  @Get('admin/brands')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getBrandsAdmin(
      @Query('search') search: string, 
      @Query('page') page: string, 
      @Query('limit') limit: string
  ) {
    return this.brandService.findAllAdmin({
        search,
        page: Number(page),
        limit: Number(limit)
    });
  }

  @Post('admin/brands')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateBrandDto) {
    return this.brandService.create(dto);
  }

  @Put('admin/brands/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(id, dto);
  }

  @Patch('admin/brands/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
      return this.brandService.toggleStatus(id);
  }

  @Delete('admin/brands/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.brandService.delete(id);
  }
}