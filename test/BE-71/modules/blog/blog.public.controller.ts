// BE-4.8/modules/blog/blog.public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { BlogQueryDto } from './dto/blog-query.dto';
import { Public } from '../../common/decorators/public.decorator'; // Đảm bảo bạn đã có decorator này

@ApiTags('Public - Blogs')
@Controller('blogs') // Route sẽ là /blogs thay vì /admin/blogs
export class PublicBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @Public() // Cho phép truy cập không cần login
  @ApiOperation({ summary: 'Get list of published blogs' })
  findAll(@Query() query: BlogQueryDto) {
    // Chỉ lấy bài viết trạng thái PUBLISHED
    return this.blogService.findAll({ ...query, status: 'PUBLISHED' });
  }

  @Get(':idOrSlug')
  @Public()
  @ApiOperation({ summary: 'Get blog details' })
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.blogService.findOne(idOrSlug);
  }
}