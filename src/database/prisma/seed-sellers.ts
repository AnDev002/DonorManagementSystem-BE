// src/database/prisma/seed-sellers.ts

import { PrismaClient, ShopStatus, Role } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

// Load biến môi trường
dotenv.config();

const prisma = new PrismaClient();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '') + '-' + Date.now() + Math.floor(Math.random() * 999);
}

async function main() {
  console.log('🚀 Bắt đầu seed 15 tài khoản Seller và Shop (Mode: Upsert)...');

  const RAW_PASSWORD = '123456'; 
  const hashedPassword = await bcrypt.hash(RAW_PASSWORD, 10);
  const numberOfSellers = 15;

  for (let i = 1; i <= numberOfSellers; i++) {
    // Lưu ý: Dùng đúng email bạn mong muốn (theo log của bạn là @gmall.com.vn)
    const email = `mall${i}@gmall.com.vn`; 
    const sellerName = `Seller ${i}`;
    const username = `seller_user_${i}`;
    const shopName = `Cửa Hàng Số ${i} Vip`;
    
    console.log(`⏳ Đang xử lý: ${sellerName} (${email})...`);

    try {
      // 1. Dùng UPSERT thay vì CREATE cho User
      // Logic: Tìm theo email. Nếu thấy -> update (giữ nguyên). Nếu chưa -> create.
      const user = await prisma.user.upsert({
        where: { email: email },
        update: {
          // Nếu user đã tồn tại, ta update lại role và shopName để đảm bảo đúng dữ liệu
          role: Role.SELLER,
          shopName: shopName,
          isVerified: true,
        },
        create: {
          email: email,
          username: username,
          password: hashedPassword,
          name: sellerName,
          role: Role.SELLER,
          isVerified: true,
          walletBalance: 0,
          shopName: shopName,
        },
      });

      // 2. Dùng UPSERT cho Shop
      // Logic: Tìm theo ownerId.
      const shopSlug = generateSlug(shopName);
      
      await prisma.shop.upsert({
        where: { ownerId: user.id },
        update: {
           // Nếu shop đã có, update lại trạng thái cho chắc chắn
           status: ShopStatus.ACTIVE,
        },
        create: {
          name: shopName,
          slug: shopSlug,
          description: `Đây là mô tả cho ${shopName}. Chuyên cung cấp các sản phẩm chất lượng cao.`,
          ownerId: user.id, 
          status: ShopStatus.ACTIVE,
          rating: 5.0,
          totalSales: Math.floor(Math.random() * 1000),
          pickupAddress: "123 Đường Demo, Quận 1, TP.HCM",
          lat: 10.762622,
          lng: 106.660172,
        },
      });

      console.log(`   ✅ Xong: User [${user.email}] <-> Shop [${shopName}]`);

    } catch (error) {
      console.error(`   ❌ Lỗi khi xử lý seller thứ ${i}:`, error);
    }
  }

  console.log('\n🎉 HOÀN TẤT QUÁ TRÌNH SEED SELLER!');
  console.log(`👉 Mật khẩu cho tất cả tài khoản là: ${RAW_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });