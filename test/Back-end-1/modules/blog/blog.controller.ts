import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { BlogQueryDto } from './dto/blog-query.dto';

// Guards & Decorators
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../../common/decorators/user.decorator';

@ApiTags('Admin - Blogs')
@Controller('admin/blogs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new blog post' })
  create(@User() user: any, @Body() createBlogDto: CreateBlogDto) {
    // Assuming 'user' object from JWT strategy contains the ID
    return this.blogService.create(user.id, createBlogDto);
  }

  @Get()
  @Roles(Role.ADMIN) // Or remove if reading is public
  @ApiOperation({ summary: 'List all blogs with pagination and filtering' })
  findAll(@Query() query: BlogQueryDto) {
    return this.blogService.findAll(query);
  }

  @Get(':idOrSlug')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get blog details by ID or Slug' })
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.blogService.findOne(idOrSlug);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update blog post' })
  update(@Param('id') id: string, @Body() updateBlogDto: UpdateBlogDto) {
    return this.blogService.update(id, updateBlogDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete blog post' })
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }

  @Patch('reorder/items') // Endpoint mới: /admin/blogs/reorder/items
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update sort order of blogs' })
  updateOrder(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.blogService.updateOrder(body.items);
  }
}