// Backend-2.2/modules/home-settings/home-settings.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class HomeSettingsService {
  constructor(private prisma: PrismaService) {}

  // 1. Client: Lấy layout hiển thị
  async getHomeLayout() {
    return this.prisma.homeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        category: {
          include: {
            // [THÊM DÒNG NÀY] Để lấy sản phẩm ra hiển thị
            products: {
              take: 12,
              include: { variants: true } // Lấy biến thể để hiện giá
            },
            // Giữ nguyên children nếu cần
            children: { take: 10, select: { id: true, name: true, slug: true, image: true } }
          }
        },
        voucher: {
          include: {
            products: {
              take: 12,
              include: { variants: true }
            }
          }
        }
      },
    });
  }

  // 2. Admin: Lấy danh sách quản lý
  async getAllSections() {
    return this.prisma.homeSection.findMany({ orderBy: { order: 'asc' } });
  }

  // Helper để làm sạch dữ liệu (Fix lỗi P2003)
  private cleanInput(data: any) {
    return {
      title: data.title || 'Untitled Section', // Default title nếu rỗng
      type: data.type,
      isActive: data.isActive !== undefined ? data.isActive : true,
      
      // FIX LỖI Ở ĐÂY: Chỉ lấy nếu chuỗi có độ dài > 0
      categoryId: (data.categoryId && data.categoryId.length > 0) ? data.categoryId : null,
      voucherId: (data.voucherId && data.voucherId.length > 0) ? data.voucherId : null,

      config: data.config || {}
    };
  }

  // 3. Admin: Tạo mới
  async createSection(data: any) {
    const lastItem = await this.prisma.homeSection.findFirst({ orderBy: { order: 'desc' } });
    const newOrder = lastItem ? lastItem.order + 1 : 0;
    
    // Gọi hàm cleanInput
    const cleanData = this.cleanInput(data);

    return this.prisma.homeSection.create({
      data: {
        ...cleanData,
        order: newOrder,
      },
    });
  }

  // 4. Admin: Cập nhật
  async updateSection(id: string, data: any) {
    const cleanData = this.cleanInput(data);
    return this.prisma.homeSection.update({
      where: { id },
      data: cleanData,
    });
  }

  async deleteSection(id: string) {
    return this.prisma.homeSection.delete({ where: { id } });
  }

  async reorderSections(ids: string[]) {
    return this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.homeSection.update({
          where: { id },
          data: { order: index },
        })
      )
    );
  }
}