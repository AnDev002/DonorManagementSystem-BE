import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';

const prisma = new PrismaClient();

// Helper tạo slug chuẩn tiếng Việt
const createSlug = (name: string) => 
  slugify(name, { lower: true, locale: 'vi', remove: /[*+~.()'"!:@]/g }) + '-' + Date.now();

// DỮ LIỆU DANH MỤC 4 CẤP
const CATEGORY_TREES = [
  {
    name: "Sức khỏe & Sắc đẹp", // Level 1
    image: "https://down-vn.img.susercontent.com/file/ef1f336ecc6f97b790d5aae9916dcb72_tn",
    children: [
      {
        name: "Chăm sóc răng miệng", // Level 2
        children: [
          {
            name: "Bàn chải", // Level 3
            children: ["Bàn chải điện", "Bàn chải thường", "Đầu bàn chải thay thế", "Máy tăm nước"] // Level 4
          },
          {
            name: "Kem đánh răng", // Level 3
            children: ["Làm trắng răng", "Cho răng nhạy cảm", "Hương thảo dược"] // Level 4
          }
        ]
      },
      {
        name: "Chăm sóc da mặt", // Level 2
        children: [
          {
            name: "Làm sạch", // Level 3
            children: ["Sữa rửa mặt", "Tẩy trang", "Tẩy tế bào chết"] // Level 4
          }
        ]
      }
    ]
  },
  {
    name: "Thiết bị điện tử", // Level 1
    image: "https://down-vn.img.susercontent.com/file/31234a27876fb89cd522d7e3db1ba5ca_tn",
    children: [
      {
        name: "Điện thoại & Phụ kiện", // Level 2
        children: [
          {
            name: "Điện thoại di động", // Level 3
            children: ["Apple", "Samsung", "Xiaomi", "Oppo"] // Level 4
          },
          {
            name: "Phụ kiện", // Level 3
            children: ["Ốp lưng", "Kính cường lực", "Cáp sạc"] // Level 4
          }
        ]
      }
    ]
  },
  {
    name: "Thời trang Nam", // Level 1
    image: "https://down-vn.img.susercontent.com/file/687f3967b7c2fe6a134a2c11894eea4b_tn",
    children: [
      {
        name: "Áo", // Level 2
        children: [
          {
            name: "Áo thun", // Level 3
            children: ["Áo thun ngắn tay", "Áo thun dài tay", "Áo Polo"] // Level 4
          }
        ]
      }
    ]
  }
];

async function main() {
  console.log('🚀 Bắt đầu thêm danh mục 4 cấp...');
  console.log('⚠️  Lưu ý: Script này KHÔNG xóa dữ liệu cũ để bảo toàn sản phẩm của bạn.');

  let count = 0;

  for (const l1 of CATEGORY_TREES) {
    // Tạo Cấp 1
    const cat1 = await prisma.category.create({
      data: { 
        name: l1.name, 
        slug: createSlug(l1.name), 
        image: l1.image 
      }
    });
    count++;

    if (l1.children) {
      for (const l2 of l1.children) {
        // Tạo Cấp 2
        const cat2 = await prisma.category.create({
          data: { 
            name: l2.name, 
            slug: createSlug(l2.name), 
            parentId: cat1.id 
          }
        });
        count++;

        if (l2.children) {
          for (const l3 of l2.children) {
            // Tạo Cấp 3
            const cat3 = await prisma.category.create({
              data: { 
                name: l3.name, 
                slug: createSlug(l3.name), 
                parentId: cat2.id 
              }
            });
            count++;

            if (l3.children) {
              for (const l4Name of l3.children) {
                // Tạo Cấp 4 (Lá)
                await prisma.category.create({
                  data: { 
                    name: l4Name, 
                    slug: createSlug(l4Name), 
                    parentId: cat3.id 
                  }
                });
                count++;
              }
            }
          }
        }
      }
    }
  }

  console.log(`✅ Đã thêm thành công ${count} danh mục mới!`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });