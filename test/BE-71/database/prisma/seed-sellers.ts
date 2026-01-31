// src/database/prisma/seed-sellers.ts

import { PrismaClient, ShopStatus, Role } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

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
  console.log('🚀 Bắt đầu seed 15 Seller (Chế độ tự sửa lỗi Conflict)...');

  const RAW_PASSWORD = '123456'; 
  const hashedPassword = await bcrypt.hash(RAW_PASSWORD, 10);
  const numberOfSellers = 15;

  for (let i = 1; i <= numberOfSellers; i++) {
    const email = `mall.0${i}@gmall.com.vn`; // Email mục tiêu
    const sellerName = `Seller ${i}`;
    const username = `seller_user_${i}`;
    const shopName = `Cửa Hàng Số ${i}`;
    
    console.log(`\n⏳ Đang xử lý: ${sellerName} (${email})...`);

    try {
      // --- BƯỚC 1: XỬ LÝ XUNG ĐỘT (QUAN TRỌNG) ---
      
      // Kiểm tra xem ShopName này đã bị user KHÁC chiếm chưa
      const conflictShopUser = await prisma.user.findUnique({
        where: { shopName: shopName }
      });

      if (conflictShopUser && conflictShopUser.email !== email) {
        console.log(`   ⚠️  Phát hiện shopName "${shopName}" đang thuộc về user cũ (${conflictShopUser.email}). Đang gỡ bỏ...`);
        // Gỡ shopName khỏi user cũ để nhường cho user mới
        await prisma.user.update({
            where: { id: conflictShopUser.id },
            data: { shopName: null } 
        });
      }

      // Kiểm tra xem Username này đã bị user KHÁC chiếm chưa
      const conflictUsernameUser = await prisma.user.findUnique({
        where: { username: username }
      });

      if (conflictUsernameUser && conflictUsernameUser.email !== email) {
        console.log(`   ⚠️  Phát hiện username "${username}" đang thuộc về user cũ (${conflictUsernameUser.email}). Đang gỡ bỏ...`);
        // Gỡ username khỏi user cũ
        await prisma.user.update({
            where: { id: conflictUsernameUser.id },
            data: { username: null }
        });
      }

      // --- BƯỚC 2: UPSERT USER ---
      const user = await prisma.user.upsert({
        where: { email: email },
        update: {
          role: Role.SELLER,
          shopName: shopName,
          isVerified: true,
          username: username, // Update lại username chuẩn
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

      // --- BƯỚC 3: UPSERT SHOP ---
      const shopSlug = generateSlug(shopName);
      
      await prisma.shop.upsert({
        where: { ownerId: user.id },
        update: {
           status: ShopStatus.ACTIVE,
           // Không update name/slug để tránh đổi URL nếu shop đã chạy
        },
        create: {
          name: shopName,
          slug: shopSlug,
          description: `Shop xịn của ${sellerName}`,
          ownerId: user.id, 
          status: ShopStatus.ACTIVE,
          rating: 5.0,
          totalSales: Math.floor(Math.random() * 1000),
          pickupAddress: "123 Đường Demo, Quận 1, TP.HCM",
          lat: 10.762622,
          lng: 106.660172,
        },
      });

      console.log(`   ✅ Thành công: ${email}`);

    } catch (error) {
      console.error(`   ❌ Lỗi không thể xử lý seller thứ ${i}:`, error);
    }
  }

  console.log('\n🎉 HOÀN TẤT!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });