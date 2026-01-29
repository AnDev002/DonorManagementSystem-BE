// import { PrismaClient } from '@prisma/client';
// import { nanoid } from 'nanoid';

// // --- 1. ĐỊNH NGHĨA HÀM SLUG TẠI CHỖ (Fix lỗi import) ---
// function generateSlug(str: string): string {
//   if (!str) return '';
//   str = str.toLowerCase();
//   str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Bỏ dấu tiếng Việt
//   str = str.replace(/[đĐ]/g, 'd');
//   str = str.replace(/([^0-9a-z-\s])/g, ''); // Xóa ký tự đặc biệt
//   str = str.replace(/(\s+)/g, '-'); // Thay khoảng trắng bằng gạch ngang
//   str = str.replace(/-+/g, '-'); // Xóa gạch ngang thừa
//   str = str.replace(/^-+|-+$/g, ''); // Cắt gạch ngang đầu cuối
//   return str;
// }

// const prisma = new PrismaClient();

// async function main() {
//   console.log('🚀 Bắt đầu chuyển đổi Seller sang Shop...');

//   // 2. Lấy tất cả User đang là SELLER (kèm check xem đã có shop chưa)
//   const sellers = await prisma.user.findMany({
//     where: { role: 'SELLER' },
//     include: { shop: true } 
//   });

//   console.log(`📦 Tìm thấy ${sellers.length} seller cần xử lý.`);

//   for (const seller of sellers) {
//     // Nếu user này đã có shop rồi thì bỏ qua để tránh trùng lặp
//     if (seller.shop) {
//       console.log(`⏩ Seller ${seller.email} đã có Shop (ID: ${seller.shop.id}), bỏ qua.`);
//       continue;
//     }

//     // 3. Tạo Shop mới từ thông tin Seller cũ
//     // Logic: Nếu không có tên shop cũ, lấy tên User hoặc Email làm tên Shop
//     const rawName = seller.shopName || seller.name || `Shop ${seller.email.split('@')[0]}`;
//     const baseSlug = generateSlug(rawName);
//     // Thêm nanoid để đảm bảo slug không trùng nhau
//     const uniqueSlug = `${baseSlug}-${nanoid(6)}`; 

//     console.log(`🛠 Đang tạo shop: "${rawName}" cho user: ${seller.email}`);

//     try {
//       const newShop = await prisma.shop.create({
//         data: {
//           ownerId: seller.id,
//           name: rawName,
//           slug: uniqueSlug,
//           // Map các trường cũ sang bảng Shop mới
//           pickupAddress: seller.pickupAddress,
//           description: seller.description,
//           coverImage: seller.coverImage,
//           avatar: seller.avatar, // Tạm dùng avatar user làm avatar shop
//           status: seller.isBanned ? 'BANNED' : 'ACTIVE', // Map trạng thái
//           rating: 0,
//           totalSales: 0
//         }
//       });

//       // 4. Migrate Products (Chuyển chủ sở hữu sản phẩm từ User sang Shop)
//       // Lưu ý: Lúc này DB vẫn còn cột sellerId cũ nên query này chạy được
//       const updateProducts = await prisma.product.updateMany({
//         where: { sellerId: seller.id },
//         data: { shopId: newShop.id }
//       });

//       // 5. Migrate Vouchers
//       const updateVouchers = await prisma.voucher.updateMany({
//         where: { sellerId: seller.id },
//         data: { shopId: newShop.id }
//       });

//       console.log(`✅ Đã tạo Shop [${newShop.name}] | Chuyển ${updateProducts.count} SP & ${updateVouchers.count} Voucher.`);
      
//     } catch (error) {
//       console.error(`❌ Lỗi khi xử lý seller ${seller.email}:`, error);
//     }
//   }

//   console.log('🎉 Hoàn tất Migration!');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });