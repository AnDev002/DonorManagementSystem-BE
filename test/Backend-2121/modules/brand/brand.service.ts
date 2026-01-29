import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Admin: List All with Counts ---
  async findAllAdmin(query: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BrandWhereInput = search
      ? { name: { contains: search } } // Removed mode: 'insensitive' for MySQL compatibility, add if using Postgres
      : {};

    const [brands, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      this.prisma.brand.count({ where }),
    ]);

    // Map to Frontend Interface
    const data = brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: b.logoUrl,
      status: b.status,
      description: b.description,
      productCount: b._count.products, // Computed field
    }));

    return {
      data,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  // --- Public/Seller: Lightweight List ---
  async findAllActive() {
    return this.prisma.brand.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        logoUrl: true, // Needed for UI dropdowns
      },
      orderBy: { name: 'asc' },
    });
  }

  // --- CRUD Operations ---
  async create(dto: CreateBrandDto) {
    const exists = await this.prisma.brand.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) {
      throw new ConflictException('Brand slug already exists');
    }

    return this.prisma.brand.create({
      data: {
        ...dto,
        status: dto.status || 'active',
      },
    });
  }

  async update(id: number, dto: UpdateBrandDto) {
    // Check existence
    await this.findById(id);

    if (dto.slug) {
        const exists = await this.prisma.brand.findUnique({ where: { slug: dto.slug } });
        if (exists && exists.id !== id) throw new ConflictException('Slug taken');
    }

    return this.prisma.brand.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: number) {
    const brand = await this.findById(id);
    
    // Check dependencies
    const productCount = await this.prisma.product.count({
        where: { brandId: id }
    });
    
    if (productCount > 0) {
        throw new ConflictException(`Cannot delete brand. It has ${productCount} products.`);
    }

    return this.prisma.brand.delete({ where: { id } });
  }

  async toggleStatus(id: number) {
      const brand = await this.findById(id);
      const newStatus = brand.status === 'active' ? 'inactive' : 'active';
      return this.prisma.brand.update({
          where: { id },
          data: { status: newStatus }
      });
  }

  async findById(id: number) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }
}