import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBannerDto, SaveConfigDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  // --- Public ---
  async getBanners(location?: string) {
    return this.prisma.banner.findMany({
      where: { 
        isActive: true, 
        ...(location ? { location } : {}) 
      },
      orderBy: { order: 'asc' },
    });
  }

  async getConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    return config?.value || null;
  }

  // --- Admin ---
  async getAllBannersAdmin() {
    return this.prisma.banner.findMany({
      orderBy: [{ location: 'asc' }, { order: 'asc' }],
    });
  }

  async createBanner(data: CreateBannerDto) {
    // Tự động gán order cuối cùng + 1
    if (data.order === undefined) {
      const lastItem = await this.prisma.banner.findFirst({
        where: { location: data.location },
        orderBy: { order: 'desc' }
      });
      data.order = lastItem ? lastItem.order + 1 : 0;
    }
    return this.prisma.banner.create({ data });
  }

  async updateBanner(id: string, data: Partial<CreateBannerDto>) {
    return this.prisma.banner.update({
      where: { id },
      data,
    });
  }

  async deleteBanner(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }

  async reorderBanners(payload: { id: string; order: number }[] | { items: { id: string; order: number }[] }) {
    // Xử lý trường hợp FE gửi mảng hoặc object
    const items = Array.isArray(payload) ? payload : payload.items;
    
    // Dùng transaction để update hàng loạt an toàn
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.banner.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );
  }

  async saveConfig(dto: SaveConfigDto) {
    return this.prisma.systemConfig.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        value: dto.value,
        description: `Config created via Admin at ${new Date().toISOString()}`
      },
      update: {
        value: dto.value
      }
    });
  }
}