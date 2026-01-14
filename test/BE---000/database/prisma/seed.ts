// Backend/database/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser'; // Sửa cách import
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import * as mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import Redis from 'ioredis';

// Load biến môi trường
dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

// --- CẤU HÌNH R2 ---
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});
const BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || '';

// --- ĐƯỜNG DẪN IMPORT ---
// Trỏ ra ngoài 3 cấp: prisma -> database -> Backend -> Root -> data-import
const IMPORT_DIR = path.join(__dirname, '../../../data-import');

// --- HÀM UPLOAD ẢNH (Từ URL -> R2) ---
async function uploadImageToR2(sourceUrl: string): Promise<string> {
  try {
    if (!sourceUrl || !sourceUrl.startsWith('http')) return '';

    // 1. Tải ảnh về buffer
    const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 10000 });
    const buffer = Buffer.from(response.data, 'binary');
    
    // 2. Tạo tên file
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const extension = mime.extension(contentType) || 'jpg';
    const fileName = `products/shopee-${uuidv4()}.${extension}`;

    // 3. Upload lên R2
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    }));

    // 4. Trả về URL thật
    return `${PUBLIC_DOMAIN}/${fileName}`;
  } catch (error) {
    console.error(`   ❌ Lỗi upload ảnh: ${sourceUrl.substring(0, 30)}...`);
    return sourceUrl; // Fallback về link cũ nếu lỗi
  }
}

const HERO_SLIDES = [
  {
    location: "HERO_MAIN",
    src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1600",
    alt: "Thời trang sành điệu",
    title: "Phong Cách Mới 2024",
    description: "Khám phá bộ sưu tập thời trang Thu Đông mới nhất. Đẳng cấp trong từng đường nét.",
    ctaLabel: "Mua Ngay",
    ctaLink: "/shop/fashion",
    theme: "dark", 
    order: 1
  },
  {
    location: "HERO_MAIN",
    src: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1600",
    alt: "Công nghệ hiện đại",
    title: "Công Nghệ Đỉnh Cao",
    description: "Trải nghiệm những sản phẩm công nghệ mới nhất với ưu đãi lên đến 40%.",
    ctaLabel: "Xem Chi Tiết",
    ctaLink: "/shop/tech",
    theme: "light",
    order: 2
  },
  {
    location: "HERO_MAIN",
    src: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=1600",
    alt: "Siêu sale cuối năm",
    title: "Sale Sập Sàn",
    description: "Cơ hội săn hàng hiệu giá hời. Hàng ngàn voucher đang chờ bạn.",
    ctaLabel: "Săn Deal Ngay",
    ctaLink: "/shop/sale",
    theme: "dark",
    order: 3
  }
];

const SUB_HERO_SLIDES = [
  { src: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=600", alt: "Trang sức cao cấp", title: "Trang Sức" },
  { src: "https://images.unsplash.com/photo-1617220828111-eb241202a929?auto=format&fit=crop&q=80&w=600", alt: "Mỹ phẩm chính hãng", title: "Mỹ Phẩm" },
  { src: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=600", alt: "Túi xách thời thượng", title: "Túi Xách" },
  { src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600", alt: "Giày hiệu năng động", title: "Giày Dép" },
].map((item, idx) => ({ ...item, location: "HERO_SUB", order: idx, ctaLink: "/shop" }));

// Helper tạo sub-items cho Mega Menu (Copy từ constants.ts)
const createSubItems = (prefix: string, count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${prefix}-sub-${i}`,
    name: `${prefix} Loại ${i + 1}`,
    slug: `${prefix}-loai-${i + 1}`,
    children: Array.from({ length: 8 }).map((_, j) => ({
      id: `${prefix}-item-${i}-${j}`,
      name: `${prefix} Sản phẩm ${j + 1}`,
      slug: `${prefix}-san-pham-${j + 1}`,
    })),
  }));
};

const FULL_CATEGORIES = [
  { id: 'dt', name: 'Điện thoại & Phụ kiện', slug: 'dien-thoai', children: createSubItems('Điện thoại', 12) },
  { id: 'mt', name: 'Máy tính & Laptop', slug: 'may-tinh', children: createSubItems('Laptop', 10) },
  { id: 'tt-nam', name: 'Thời Trang Nam', slug: 'thoi-trang-nam', children: createSubItems('Nam', 15) },
  { id: 'tt-nu', name: 'Thời Trang Nữ', slug: 'thoi-trang-nu', children: createSubItems('Nữ', 15) },
  { id: 'me-be', name: 'Mẹ & Bé', slug: 'me-be', children: createSubItems('Mẹ Bé', 12) },
];

const RECIPIENT_DATA = [
  {
    groupName: "Cho Phụ Nữ",
    items: [
      { title: "Mẹ & Bà", links: ["Quà tặng Mẹ", "Quà tặng Bà", "Mẹ chồng/Mẹ vợ", "Phụ nữ trung niên"] },
      { title: "Người Yêu & Vợ", links: ["Bạn gái mới quen", "Vợ yêu", "Vợ bầu", "Cầu hôn & Tỏ tình"] },
    ],
  },
  {
    groupName: "Cho Nam Giới",
    items: [
      { title: "Bố & Ông", links: ["Quà tặng Bố", "Quà tặng Ông", "Bố chồng/Bố vợ"] },
      { title: "Người Yêu & Chồng", links: ["Bạn trai", "Chồng yêu", "Quà kỷ niệm"] },
    ],
  },
];

const OCCASION_DATA = [
  {
    groupName: "Ngày Lễ Trong Năm",
    items: [
      { title: "Dịp Đầu Năm", links: ["Tết Nguyên Đán", "Tết Dương Lịch", "Lễ Tình Nhân (14/2)"] },
      { title: "Dịp Quốc Tế", links: ["Quốc tế Phụ nữ (8/3)", "Ngày của Mẹ"] },
    ],
  },
];

const BUSINESS_GIFT_DATA = [
  {
    groupName: "Quà Tặng Vinh Danh",
    items: [
      { title: "Biểu Trưng", links: ["Cúp pha lê", "Cúp kim loại", "Huy chương"] },
    ],
  },
];

const FOOTER_LINKS = {
  about: {
    title: "Về chúng tôi",
    links: [
      { label: "Giới thiệu LoveGifts", href: "/about" },
      { label: "Tuyển dụng", href: "/careers" },
    ],
  },
  support: {
    title: "Hỗ trợ khách hàng",
    links: [
      { label: "Hướng dẫn mua hàng", href: "/guide" },
      { label: "Phương thức thanh toán", href: "/payment-policy" },
    ],
  },
};

// --- HÀM SEED CONTENT ---
async function seedContent() {
  console.log('🌱 Seeding Banners & System Config...');
  
  // 1. Seed Banners
  const existingBanners = await prisma.banner.count();
  if (existingBanners === 0) {
     for (const slide of [...HERO_SLIDES, ...SUB_HERO_SLIDES]) {
        await prisma.banner.create({ data: slide });
     }
  }

  // 2. Seed System Config (Menus)
  const configs = [
    { key: 'HEADER_CATEGORIES', value: FULL_CATEGORIES, desc: 'Mega Menu Danh Mục' },
    { key: 'HEADER_RECIPIENT', value: RECIPIENT_DATA, desc: 'Menu Người Nhận' },
    { key: 'HEADER_OCCASION', value: OCCASION_DATA, desc: 'Menu Nhân Dịp' },
    { key: 'HEADER_BUSINESS', value: BUSINESS_GIFT_DATA, desc: 'Menu Quà Doanh Nghiệp' },
    { key: 'FOOTER_DATA', value: FOOTER_LINKS, desc: 'Liên kết Footer' }
  ];

  for (const conf of configs) {
    await prisma.systemConfig.upsert({
      where: { key: conf.key },
      update: {}, // Không overwrite nếu đã có
      create: {
        key: conf.key,
        value: conf.value, // Prisma tự convert JSON
        description: conf.desc
      }
    });
  }
}

// --- LOGIC PHÂN LOẠI DANH MỤC ---
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
  // ... Thêm các nhóm khác nếu cần
];

function detectCategory(name: string) {
  const lowerName = name.toLowerCase();
  for (const group of CATEGORY_TREE) {
    for (const child of group.children) {
      if (child.keywords.some(k => lowerName.includes(k))) {
        return { parentName: group.parent, childName: child.name };
      }
    }
  }
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
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now() + Math.floor(Math.random() * 999);
}

function generateCatSlug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-').replace(/[^\w-]+/g, '');
}

// --- HÀM XỬ LÝ 1 FILE CSV ---
async function processSingleFile(
  fullPath: string, 
  fileName: string, 
  sellerId: string, 
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
        
        // Duyệt từng dòng CSV
        for (const row of results) {
          try {
            // Mapping cột theo file CSV của bạn: 1=Ảnh, 4=Tên, 6=Giá, 7=Bán
            const rawImageUrl = row[1];
            const name = row[4];
            const rawPrice = row[6];
            const rawSales = row[7];

            if (!name || name.length < 5 || !rawPrice) continue;

            // 1. Phân tích danh mục
            const { parentName, childName } = detectCategory(name);
            const mapKey = `${parentName}|${childName}`;
            let childCategoryId = categoryMap.get(mapKey);

            if (!childCategoryId) {
              // Tạo/Lấy Cha
              const parentSlug = generateCatSlug(parentName);
              const parentCat = await prisma.category.upsert({
                where: { slug: parentSlug },
                update: {},
                create: { name: parentName, slug: parentSlug, parentId: null },
              });

              // Tạo/Lấy Con
              const childSlug = generateCatSlug(childName);
              const childCat = await prisma.category.upsert({
                where: { slug: childSlug },
                update: {},
                create: { 
                  name: childName, 
                  slug: childSlug, 
                  parentId: parentCat.id,
                },
              });
              childCategoryId = childCat.id;
              categoryMap.set(mapKey, childCategoryId);
            }

            // 2. UPLOAD ẢNH (Quan trọng)
            let finalImageUrl = rawImageUrl;
            if (rawImageUrl && rawImageUrl.startsWith('http')) {
                console.log(`   ⬆️ Uploading: ${name.substring(0, 20)}...`);
                finalImageUrl = await uploadImageToR2(rawImageUrl);
            }

            // 3. Tạo Sản Phẩm
            const price = cleanPrice(rawPrice);
            const salesCount = parseSalesCount(rawSales);
            const rating = (Math.random() * (5.0 - 4.2) + 4.2).toFixed(1);

            await prisma.product.create({
              data: {
                name: name.trim(),
                slug: generateSlug(name),
                description: `Mô tả: ${name}. ${rawSales || ''}. Hàng chính hãng, chất lượng cao.`,
                price: price,
                originalPrice: price * 1.25,
                stock: Math.floor(Math.random() * 300) + 10,
                salesCount: salesCount,
                rating: parseFloat(rating),
                images: finalImageUrl ? [{ url: finalImageUrl }] : [], // Lưu ảnh JSON đúng format
                sellerId: sellerId,
                categoryId: childCategoryId,
                attributes: JSON.stringify({ origin: "Việt Nam", brand: "No Brand" }), // Lưu JSON attributes
                status: 'ACTIVE'
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

// --- MAIN ---
async function main() {
  console.log('🚀 Bắt đầu quá trình Import & Upload R2...');

  // // 1. TÌM SELLER HIỆN TẠI (Thay vì tạo mới)
  // const seller = await prisma.user.findFirst({
  //   where: { role: { in: ['SELLER', 'PENDING_SELLER'] } }
  // });

  // if (!seller) {
  //   console.error("❌ LỖI: Không tìm thấy tài khoản Seller nào! Vui lòng đăng ký seller trước.");
  //   process.exit(1);
  // }
  // console.log(`👤 Sử dụng Seller: ${seller.name} (ID: ${seller.id})`);

  // // Cache danh mục
  // const globalCategoryMap = new Map<string, string>();

  // // 2. KIỂM TRA THƯ MỤC CSV
  // if (!fs.existsSync(IMPORT_DIR)) {
  //   console.error(`❌ Không tìm thấy thư mục: ${IMPORT_DIR}`);
  //   console.log(`👉 Hãy chắc chắn bạn đã để folder 'data-import' ngang hàng với folder 'src' hoặc 'Backend'.`);
  //   return;
  // }

  // const files = fs.readdirSync(IMPORT_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
  // if (files.length === 0) {
  //   console.log(`⚠️ Thư mục 'data-import' trống.`);
  //   return;
  // }

  // console.log(`📦 Tìm thấy ${files.length} file CSV.`);

  // // 3. CHẠY IMPORT
  // for (const fileName of files) {
  //   const fullPath = path.join(IMPORT_DIR, fileName);
  //   await processSingleFile(fullPath, fileName, seller.id, globalCategoryMap);
  // }

  // console.log(`\n🎉 HOÀN TẤT! Dữ liệu đã import và ảnh đã được upload lên R2.`);
  await seedContent();
  console.log(`\n🎉 HOÀN TẤT! Seed dữ liệu danh mục.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });