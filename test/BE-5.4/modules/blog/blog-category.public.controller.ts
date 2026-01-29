// File: BE-4.3/modules/blog/blog-category.controller.ts

import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BlogCategoryService } from './blog-category.service';
// [FIX] Sửa lại đường dẫn import chính xác
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; // auth ngang hàng blog trong modules
import { RolesGuard } from '../../common/guards/roles.guard'; // common nằm ngoài modules
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Public - Blogs')
@Controller('blog-categories')
export class PublicBlogCategoryController {
  constructor(private readonly service: BlogCategoryService) {}
  @Get()
  findAll() {
    return this.service.findAll();
  }
}