import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { DatabaseModule } from '../../database/database.module';
import { BlogCategoryService } from './blog-category.service';
import { BlogCategoryController } from './blog-category.controller';
import { PublicBlogController } from './blog.public.controller';
import { PublicBlogCategoryController } from './blog-category.public.controller';

@Module({
  imports: [DatabaseModule], // Ensures PrismaService is available
  controllers: [BlogController, BlogCategoryController, PublicBlogController, PublicBlogCategoryController],
  providers: [BlogService, BlogCategoryService],
  exports: [BlogService], // Export if other modules need to read blogs
})
export class BlogModule {}