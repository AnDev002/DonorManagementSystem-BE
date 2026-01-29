// src/modules/blog/blog-category.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
// [FIX] Import chính xác hàm generateSlug, KHÔNG import SlugUtil
import { generateSlug } from '../../common/utils/slug.util'; 

@Injectable()
export class BlogCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; parentId?: string }) {
    return this.prisma.blogCategory.create({
      data: {
        name: data.name,
        // [FIX] Gọi trực tiếp hàm generateSlug(string)
        slug: generateSlug(data.name), 
        parentId: data.parentId || null,
      },
    });
  }

  async findAll() {
    return this.prisma.blogCategory.findMany({
      include: { children: true }, // Lấy danh mục con nếu có
    });
  }

  async remove(id: string) {
    return this.prisma.blogCategory.delete({ where: { id } });
  }
}