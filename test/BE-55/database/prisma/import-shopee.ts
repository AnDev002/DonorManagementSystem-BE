// src/database/prisma/import-shopee.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv = require('csv-parser');

const prisma = new PrismaClient();

// --- CẤU HÌNH ĐƯỜNG DẪN ---
const IMPORT_DIR = path.join(__dirname, '../../../data-import');

// --- CẤU HÌNH CÂY DANH MỤC (CHA -> CON -> TỪ KHÓA) ---
const CATEGORY_TREE = [
  {
    parent: "THỜI TRANG NỮ",
    children: [
      { name: "Áo Nữ", keywords: ['áo', 'top', 'croptop', 'polo', 'hoodie', 'sweater', 'cardigan', 'khoác', 'jacket', 'blazer'] },
      { name: "Quần & Chân Váy", keywords: ['quần', 'jeans', 'kaki', 'short', 'legging', 'váy', 'skirt'] },
      { name: "Đầm & Váy Liền", keywords: ['đầm', 'dress', 'yếm', 'jum', 'liền thân'] },
      { name: "Đồ Lót & Đồ Ngủ", keywords: ['lót', 'ngủ', 'bra', 'chip', 'nội y', 'pyjama'] },
      { name: "Giày Dép & Phụ Kiện", keywords: ['giày', 'dép', 'guốc', 'boot', 'túi', 'balo', 'ví', 'nón', 'kính', 'tất', 'vớ'] }
    ]
  },
  {
    parent: "ĐỒ ĐIỆN TỬ",
    children: [
      { name: "Phụ Kiện Điện Thoại", keywords: ['ốp', 'cường lực', 'dán', 'cáp', 'sạc', 'pin', 'giá đỡ', 'pop'] },
      { name: "Thiết Bị Âm Thanh", keywords: ['tai nghe', 'loa', 'mic', 'audio'] },
      { name: "Máy Tính & Laptop", keywords: ['laptop', 'chuột', 'phím', 'pad', 'usb', 'thẻ nhớ', 'wifi'] },
      { name: "Điện Gia Dụng", keywords: ['quạt', 'đèn', 'máy', 'nồi', 'bếp', 'ấm'] }
    ]
  },
  {
    parent: "SẮC ĐẸP",
    children: [
      { name: "Trang Điểm", keywords: ['son', 'phấn', 'cushion', 'mascara', 'kẻ', 'mi'] },
      { name: "Chăm Sóc Da", keywords: ['kem', 'serum', 'toner', 'sữa rửa mặt', 'tẩy trang', 'mặt nạ', 'lotion'] },
      { name: "Chăm Sóc Tóc & Cơ Thể", keywords: ['gội', 'xả', 'tắm', 'dưỡng', 'nước hoa', 'body'] }
    ]
  },
  {
    parent: "BÁCH HÓA ONLINE",
    children: [
      { name: "Đồ Ăn Vặt", keywords: ['bánh', 'kẹo', 'snack', 'khô', 'cơm cháy', 'rong biển', 'đậu'] },
      { name: "Đồ Uống & Sữa", keywords: ['trà', 'sữa', 'cà phê', 'nước', 'ngọt', 'gas'] },
      { name: "Thực Phẩm Nấu Ăn", keywords: ['mì', 'miến', 'phở', 'gia vị', 'sốt', 'dầu'] }
    ]
  },
  {
    parent: "QUÀ HANDMADE",
    children: [
      { name: "Nguyên Liệu DIY", keywords: ['len', 'sợi', 'kẽm', 'nhung', 'charm', 'hạt', 'vải'] },
      { name: "Thành Phẩm Handmade", keywords: ['handmade', 'thủ công', 'móc khóa', 'thú bông', 'hoa len', 'tô tượng'] }
    ]
  },
  {
    parent: "QUÀ CAO CẤP",
    children: [
      { name: "Set Quà Tặng", keywords: ['set quà', 'hộp quà', 'gift', 'quà tặng'] },
      { name: "Sức Khỏe & Tổ Yến", keywords: ['yến', 'sâm', 'đông trùng', 'thực phẩm chức năng'] }
    ]
  }
];

// --- CÁC HÀM XỬ LÝ LOGIC ---

// 1. Hàm đoán danh mục (Trả về cả Cha và Con)
function detectCategory(name: string) {
  const lowerName = name.toLowerCase();
  
  for (const group of CATEGORY_TREE) {
    for (const child of group.children) {
      // Check xem tên sản phẩm có chứa từ khóa nào của con không
      if (child.keywords.some(k => lowerName.includes(k))) {
        return { parentName: group.parent, childName: child.name };
      }
    }
  }

  // Fallback nếu không tìm thấy
  return { parentName: "Sản Phẩm Khác", childName: "Chưa Phân Loại" };
}

function cleanPrice(rawPrice: string): number {
  if (!rawPrice) return 0;
  const cleanString = rawPrice.replace(/[^\d]/g, '');
  let price = parseInt(cleanString, 10);
  if (price > 0 && price < 10000) price = price * 1000;
  return price;
}

function parseSalesCount(rawSales: string): number {
  if (!rawSales) return 0;
  const match = rawSales.toLowerCase().match(/([\d,\.]+)(k?)/);
  if (!match) return 0;
  let num = parseFloat(match[1].replace(',', '.'));
  if (match[2] === 'k') num = num * 1000;
  return Math.floor(num);
}

function generateSlug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now() + Math.floor(Math.random() * 9999);
}

// Slug cho danh mục (đơn giản hơn)
function generateCatSlug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '');
}

// --- HÀM XỬ LÝ 1 FILE ---
async function processSingleFile(
  fullPath: string, 
  fileName: string, 
  sellerId: string, 
  // Cache để lưu ID các danh mục đã tạo (Key: "ParentName|ChildName" -> Value: ChildId)
  categoryMap: Map<string, string> 
) {
  return new Promise<void>((resolve, reject) => {
    const results: any[] = [];
    console.log(`📂 Đang đọc file: ${fileName}...`);

    fs.createReadStream(fullPath)
      .pipe(csv({ headers: false }))
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let count = 0;
        
        for (const row of results) {
          try {
            // Cột: 1=Ảnh, 4=Tên, 6=Giá, 7=Bán
            const imageUrl = row[1];
            const name = row[4];
            const rawPrice = row[6];
            const rawSales = row[7];

            if (!name || name.length < 5 || !rawPrice) continue;

            // 1. Phân tích danh mục Cha/Con
            const { parentName, childName } = detectCategory(name);
            const mapKey = `${parentName}|${childName}`;

            // 2. Lấy ID danh mục Con (nếu chưa có trong cache thì tạo DB)
            let childCategoryId = categoryMap.get(mapKey);

            if (!childCategoryId) {
              // A. Tạo/Lấy Cha trước
              const parentSlug = generateCatSlug(parentName);
              const parentCat = await prisma.category.upsert({
                where: { slug: parentSlug },
                update: {},
                create: { name: parentName, slug: parentSlug, parentId: null, image: imageUrl },
              });

              // B. Tạo/Lấy Con (Gắn vào Cha)
              const childSlug = generateCatSlug(childName);
              const childCat = await prisma.category.upsert({
                where: { slug: childSlug },
                update: {},
                create: { 
                  name: childName, 
                  slug: childSlug, 
                  parentId: parentCat.id, // Liên kết Cha-Con
                  image: imageUrl 
                },
              });

              childCategoryId = childCat.id;
              categoryMap.set(mapKey, childCategoryId); // Lưu cache
            }

            // 3. Tạo Sản Phẩm
            const price = cleanPrice(rawPrice);
            const salesCount = parseSalesCount(rawSales);
            const rating = (Math.random() * (5.0 - 4.2) + 4.2).toFixed(1);

            await prisma.product.create({
              data: {
                name: name.trim(),
                slug: generateSlug(name),
                description: `Mô tả: ${name}. ${rawSales || ''}.`,
                price: price,
                originalPrice: price * 1.25,
                stock: Math.floor(Math.random() * 300) + 10,
                salesCount: salesCount,
                rating: parseFloat(rating),
                images: imageUrl ? [imageUrl] : [],
                sellerId: sellerId,
                categoryId: childCategoryId, // Gắn vào danh mục CON
                attributes: { origin: "Việt Nam", brand: "No Brand" }
              },
            });
            count++;
          } catch (error) {
             // Bỏ qua lỗi nhỏ
          }
        }
        console.log(`   -> ✅ Đã xong file ${fileName}: ${count} sản phẩm.`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`   -> ❌ Lỗi file ${fileName}:`, err);
        resolve(); 
      });
  });
}

// --- HÀM MAIN ---
async function importShopeeData() {
  console.log('🗑️  Clean Database (Xóa sạch làm lại)...');
  await prisma.cartItem.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  console.log('✅ Đã xoá sạch dữ liệu cũ.');

  // Tạo Seller mặc định
  const defaultSeller = await prisma.user.upsert({
    where: { email: 'seller@shopee.vn' },
    update: {},
    create: {
      email: 'seller@shopee.vn', name: 'Official Store', password: 'password123', role: 'SELLER',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
    },
  });

  // Bộ nhớ đệm ID danh mục (để đỡ query DB nhiều lần)
  const globalCategoryMap = new Map<string, string>();

  // 1. KIỂM TRA THƯ MỤC
  if (!fs.existsSync(IMPORT_DIR)) {
    fs.mkdirSync(IMPORT_DIR);
    console.log(`⚠️ Đã tạo thư mục "data-import". Vui lòng copy file .csv vào và chạy lại!`);
    return;
  }

  // 2. QUÉT FILE
  const files = fs.readdirSync(IMPORT_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
  if (files.length === 0) {
    console.log(`⚠️ Không tìm thấy file .csv nào trong "data-import".`);
    return;
  }

  console.log(`📦 Tìm thấy ${files.length} file CSV.`);

  // 3. CHẠY VÒNG LẶP
  for (const fileName of files) {
    const fullPath = path.join(IMPORT_DIR, fileName);
    await processSingleFile(fullPath, fileName, defaultSeller.id, globalCategoryMap);
  }

  console.log(`\n🎉 HOÀN TẤT! Dữ liệu đã được phân loại vào danh mục 2 cấp.`);
  await prisma.$disconnect();
}

importShopeeData().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});