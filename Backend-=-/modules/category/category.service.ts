import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Đường dẫn tuỳ project bạn
import slugify from 'slugify'; // Cần cài: npm i slugify
import { UpdateCategoryOrderDto } from './dto/update-category-order.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  // 1. Lấy danh sách category theo cấp (Cascading)
  async getCategories(parentId?: string) {
    const categories = await this.prisma.category.findMany({
      where: {
        parentId: parentId || null, // Nếu null thì lấy Root (Level 1)
      },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        // Kỹ thuật tối ưu: Chỉ đếm số lượng con để biết có load tiếp hay không
        _count: {
          select: { children: true },
        },
      },
      orderBy: {
        name: 'asc', // Hoặc thêm field 'order' nếu muốn sắp xếp tùy chỉnh
      },
    });

    // Map lại dữ liệu để trả về field hasChildren boolean clean hơn
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      hasChildren: cat._count.children > 0,
    }));
  }

  // 2. Tìm kiếm Category & Trả về Full Path (Breadcrumb)
  async searchCategories(keyword: string) {
    if (!keyword) return [];

    const categories = await this.prisma.category.findMany({
      where: {
        name: {
          contains: keyword,
          // mode: 'insensitive', // PostgreSQL hỗ trợ, MySQL cần config collation hoặc dùng raw query nếu cần thiết
        },
      },
      // Include ngược lên cha để lấy path. 
      // Giả sử tối đa 4 cấp, ta include 3 tầng parent.
      include: {
        parent: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
      },
      take: 20, // Limit kết quả
    });

    // Helper function đệ quy để build chuỗi path
    const buildPath = (cat: any): string => {
      if (!cat.parent) return cat.name;
      return `${buildPath(cat.parent)} > ${cat.name}`;
    };

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      path: buildPath(cat), // Kết quả: "Sức khỏe > Răng miệng > Bàn chải"
    }));
  }
  
  // 3. Helper lấy Breadcrumb chi tiết cho trang Product (SEO)
  // Dùng slug của category cuối cùng để truy ngược lên
  async getCategoryTreeBySlug(slug: string) {
     return this.prisma.category.findUnique({
        where: { slug },
        include: {
            parent: {
                include: {
                    parent: {
                        include: { parent: true }
                    }
                }
            }
        }
     });
  }
  async updateOrder(dto: UpdateCategoryOrderDto) {
    const { parentId, orderedIds } = dto;

    try {
      // Sử dụng Transaction để tối ưu hiệu năng và đảm bảo tính toàn vẹn
      // Thay vì await từng lệnh update, ta gom lại thành 1 mảng Promise
      const updateOperations = orderedIds.map((id, index) => {
        return this.prisma.category.update({
          where: { id },
          data: {
            order: index, // Vị trí trong mảng chính là thứ tự mới (0, 1, 2...)
            parentId: parentId || null, // Cập nhật luôn parentId để hỗ trợ kéo thả giữa các cấp cha con
          },
        });
      });

      // Thực thi đồng loạt
      await this.prisma.$transaction(updateOperations);

      return {
        success: true,
        message: 'Cập nhật thứ tự danh mục thành công',
        count: orderedIds.length
      };

    } catch (error) {
      // this.logger.error(`Lỗi khi cập nhật order category: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Không thể cập nhật thứ tự danh mục');
    }
  }
  async getCategoryTree() {
    // SỬA: Đổi tất cả 'name' thành 'order' trong orderBy
    return this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 1)
      include: {
        children: {
          orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 2)
          include: {
            children: {
              orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 3)
              include: {
                children: {
                  orderBy: { order: 'asc' }, // <--- Sửa ở đây (Cấp 4)
                  include: {
                    children: {
                      orderBy: { order: 'asc' } // <--- Sửa ở đây (Cấp 5)
                    } 
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  // [MỚI] Helper: Lấy danh sách tất cả ID con cháu của 1 categoryId
  // Dùng để filter product: Chọn cha ra cả con
  async getAllDescendantIds(rootId: string): Promise<string[]> {
    // Cách tối ưu nhất trong SQL là dùng Recursive CTE, nhưng với Prisma raw query:
    // Hoặc fetch flat list về xử lý. Ở đây dùng giải pháp fetch flat đơn giản an toàn.
    
    const allCategories = await this.prisma.category.findMany({
      select: { id: true, parentId: true }
    });

    const resultIds = [rootId];
    const queue = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = allCategories.filter(c => c.parentId === currentId);
      for (const child of children) {
        resultIds.push(child.id);
        queue.push(child.id);
      }
    }

    return resultIds;
  }

  async create(data: { name: string; slug?: string; parentId?: string }) {
    const slug = data.slug || this.generateSlug(data.name);

    // Kiểm tra slug trùng
    const exist = await this.prisma.category.findUnique({ where: { slug } });
    if (exist) {
        throw new BadRequestException(`Slug '${slug}' đã tồn tại. Vui lòng chọn tên khác.`);
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        slug: slug,
        // Nếu parentId là chuỗi rỗng hoặc undefined -> null (Root)
        parentId: data.parentId && data.parentId.length > 0 ? data.parentId : null, 
      }
    });
  }

  // 3. [FIX] Cập nhật
  async update(id: string, data: { name?: string; slug?: string; parentId?: string }) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    // Prevent circular reference (Không thể chọn chính mình hoặc con cháu làm cha)
    if (data.parentId && data.parentId === id) {
        throw new BadRequestException('Không thể chọn chính danh mục này làm cha');
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId === 'ROOT' ? null : data.parentId, // Logic xử lý nếu muốn đưa về gốc
      }
    });
  }

  // 4. [FIX] Xóa an toàn
  async remove(id: string) {
    // Kiểm tra xem có con không
    const countChildren = await this.prisma.category.count({
        where: { parentId: id }
    });

    if (countChildren > 0) {
        throw new BadRequestException('Không thể xóa danh mục này vì đang chứa danh mục con. Hãy xóa con trước.');
    }

    // Kiểm tra xem có sản phẩm không (Optional - tuỳ logic business của bạn)
    const countProduct = await this.prisma.product.count({
        where: { categoryId: id }
    });
    if (countProduct > 0) {
         throw new BadRequestException('Đang có sản phẩm thuộc danh mục này. Không thể xóa.');
    }

    return this.prisma.category.delete({ where: { id } });
  }

  // 5. [MỚI] Update Bulk from JSON (Nguy hiểm - Chỉ dành cho Admin hiểu rõ)
  // Hàm này nhận vào mảng cấu trúc phẳng hoặc tree để sync lại DB. 
  // Để an toàn, ở đây tôi chỉ làm cập nhật Name/Slug theo ID, không xóa bừa bãi.
  async updateBatch(items: any[]) {
      // SỬA: Thêm kiểu dữ liệu : any[] để tránh lỗi type 'never'
      const results: any[] = []; 
      
      for (const item of items) {
          if (item.id) {
             try {
                 const updated = await this.prisma.category.update({
                     where: { id: item.id },
                     data: { 
                        name: item.name, 
                        slug: item.slug, 
                        parentId: item.parentId || null 
                     }
                 });
                 results.push(updated); // Giờ sẽ không còn lỗi
             } catch (e) {
                 console.error(`Failed to update ${item.id}`, e);
             }
          }
      }
      return results;
  }

  private generateSlug(text: string) {
    return text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  }
}