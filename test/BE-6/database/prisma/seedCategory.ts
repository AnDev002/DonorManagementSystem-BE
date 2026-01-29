// Backend/database/prisma/seed.ts

import { PrismaClient } from '@prisma/client';

// Khởi tạo Prisma
const prisma = new PrismaClient();

// --- 1. DỮ LIỆU BANNER (Từ src/modules/home/data/heroData.ts) ---
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
  },
  {
    location: "HERO_MAIN",
    src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1600",
    alt: "Thời trang sành điệu (Loop)",
    title: "Phong Cách Mới 2024",
    description: "Khám phá bộ sưu tập thời trang Thu Đông mới nhất.",
    ctaLabel: "Mua Ngay",
    ctaLink: "/shop/fashion",
    theme: "dark", 
    order: 4
  }
];

const SUB_HERO_SLIDES = [
  {
    location: "HERO_SUB",
    src: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=600",
    alt: "Trang sức cao cấp",
    title: "Trang Sức",
    ctaLink: "/shop/jewelry",
    order: 1
  },
  {
    location: "HERO_SUB",
    src: "https://images.unsplash.com/photo-1617220828111-eb241202a929?auto=format&fit=crop&q=80&w=600",
    alt: "Mỹ phẩm chính hãng",
    title: "Mỹ Phẩm",
    ctaLink: "/shop/cosmetics",
    order: 2
  },
  {
    location: "HERO_SUB",
    src: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=600",
    alt: "Túi xách thời thượng",
    title: "Túi Xách",
    ctaLink: "/shop/bags",
    order: 3
  },
  {
    location: "HERO_SUB",
    src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600",
    alt: "Giày hiệu năng động",
    title: "Giày Dép",
    ctaLink: "/shop/shoes",
    order: 4
  },
  {
    location: "HERO_SUB",
    src: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=600",
    alt: "Trang sức cao cấp (Loop)",
    title: "Trang Sức",
    ctaLink: "/shop/jewelry",
    order: 5
  },
];

// --- 2. DỮ LIỆU MENUS (Từ src/components/layout/Header/constants.ts) ---

// Helper tạo sub-items
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
  { id: 'nha-cua', name: 'Nhà Cửa & Đời Sống', slug: 'nha-cua', children: createSubItems('Nhà cửa', 10) },
  { id: 'my-pham', name: 'Sắc Đẹp & Mỹ Phẩm', slug: 'sac-dep', children: createSubItems('Mỹ phẩm', 12) },
  { id: 'sk', name: 'Sức Khỏe', slug: 'suc-khoe', children: createSubItems('Thuốc', 8) },
  { id: 'giay-dep', name: 'Giày Dép Nam/Nữ', slug: 'giay-dep', children: createSubItems('Giày', 10) },
  { id: 'tui-vi', name: 'Túi Ví Thời Trang', slug: 'tui-vi', children: createSubItems('Túi', 10) },
  { id: 'dong-ho', name: 'Đồng Hồ & Trang Sức', slug: 'dong-ho', children: createSubItems('Đồng hồ', 8) },
  { id: 'the-thao', name: 'Thể Thao & Du Lịch', slug: 'the-thao', children: createSubItems('Sport', 10) },
  { id: 'oto', name: 'Ô Tô & Xe Máy', slug: 'oto-xe-may', children: createSubItems('Xe', 8) },
  { id: 'sach', name: 'Nhà Sách Online', slug: 'nha-sach', children: createSubItems('Sách', 12) },
  { id: 'voucher', name: 'Voucher & Dịch Vụ', slug: 'voucher', children: createSubItems('Voucher', 4) },
];

const RECIPIENT_DATA = [
  {
    groupName: "Cho Phụ Nữ",
    items: [
      {
        title: "Người Thân",
        links: ["Quà tặng Mẹ", "Quà tặng Bà", "Quà tặng Vợ", "Quà tặng Con gái", "Chị gái & Em gái", "Mẹ chồng / Mẹ vợ"]
      },
      {
        title: "Tình Yêu",
        links: ["Bạn gái mới quen", "Người yêu (Crush)", "Vợ bầu / Mới sinh", "Cầu hôn & Tỏ tình", "Kỷ niệm ngày cưới"]
      },
      {
        title: "Quan Hệ Xã Hội",
        links: ["Quà tặng Sếp nữ", "Quà tặng Cô giáo", "Đồng nghiệp nữ", "Bạn thân (Nữ)", "Đối tác nữ"]
      }
    ]
  },
  {
    groupName: "Cho Nam Giới",
    items: [
      {
        title: "Người Thân",
        links: ["Quà tặng Bố", "Quà tặng Ông", "Quà tặng Chồng", "Quà tặng Con trai", "Anh trai & Em trai", "Bố chồng / Bố vợ"]
      },
      {
        title: "Tình Yêu",
        links: ["Bạn trai mới quen", "Người yêu", "Quà kỷ niệm tình yêu", "Quà xin lỗi"]
      },
      {
        title: "Quan Hệ Xã Hội",
        links: ["Quà tặng Sếp nam", "Quà tặng Thầy giáo", "Đồng nghiệp nam", "Bạn thân (Nam)", "Đối tác nam"]
      }
    ]
  },
  {
    groupName: "Đối Tượng Khác",
    items: [
      {
        title: "Trẻ Em & Em Bé",
        links: ["Bé trai (1-3 tuổi)", "Bé gái (1-3 tuổi)", "Trẻ sơ sinh (0-12 tháng)", "Bé mẫu giáo (3-5 tuổi)", "Học sinh tiểu học", "Đồ chơi thông minh"]
      },
      {
        title: "Người Cao Tuổi",
        links: ["Quà mừng thọ", "Thực phẩm sức khỏe", "Thiết bị massage", "Trà & Thảo dược", "Quà tặng Ông Bà"]
      },
      {
        title: "Đặc Biệt",
        links: ["Người nước ngoài", "Cung Hoàng Đạo", "Tín đồ Công nghệ", "Yêu thích Thể thao", "Yêu thích Nấu ăn"]
      }
    ]
  }
];

const OCCASION_DATA = [
  {
    groupName: "Sự Kiện Trong Năm",
    items: [
      {
        title: "Dịp Đầu Năm",
        links: ["Tết Nguyên Đán", "Tết Dương Lịch", "Lễ Tình Nhân (14/2)", "Ngày Thần Tài", "Quốc tế Phụ nữ (8/3)"]
      },
      {
        title: "Dịp Giữa Năm",
        links: ["Ngày của Mẹ (Mother's Day)", "Ngày của Cha (Father's Day)", "Quốc tế Thiếu nhi (1/6)", "Lễ Vu Lan (Báo hiếu)"]
      },
      {
        title: "Dịp Cuối Năm",
        links: ["Phụ nữ Việt Nam (20/10)", "Ngày Nhà giáo (20/11)", "Lễ Giáng Sinh (Noel)", "Black Friday", "Tất niên"]
      }
    ]
  },
  {
    groupName: "Dịp Đặc Biệt Cá Nhân",
    items: [
      {
        title: "Sinh Nhật",
        links: ["Sinh nhật Bạn gái/Vợ", "Sinh nhật Bạn trai/Chồng", "Sinh nhật Bố Mẹ", "Sinh nhật Bạn thân", "Sinh nhật Bé", "Thôi nôi (1 tuổi)"]
      },
      {
        title: "Kỷ Niệm Tình Yêu",
        links: ["Kỷ niệm 1 năm yêu", "Kỷ niệm ngày cưới", "Kỷ niệm ngày quen nhau", "Hâm nóng tình cảm"]
      },
      {
        title: "Chúc Mừng & Cảm Ơn",
        links: ["Lễ Tốt Nghiệp", "Tân gia (Nhà mới)", "Khai trương cửa hàng", "Thăng chức", "Nghỉ hưu", "Lời Cảm ơn", "Xin lỗi"]
      }
    ]
  },
  {
    groupName: "Thăm Hỏi & Sức Khỏe",
    items: [
      {
        title: "Thăm Hỏi",
        links: ["Thăm người ốm", "Thăm bà bầu", "Mừng đầy tháng", "Quà chia tay"]
      },
      {
        title: "Tâm Linh & Phong Thủy",
        links: ["Vật phẩm phong thủy", "Vòng tay trầm hương", "Tượng linh vật", "Tranh treo tường"]
      }
    ]
  }
];

const BUSINESS_GIFT_DATA = [
  {
    groupName: "Quà Tặng Sự Kiện",
    items: [
      {
        title: "Hội Nghị & Hội Thảo",
        links: ["Sổ tay & Bút ký", "Túi vải Canvas", "Bình giữ nhiệt in logo", "Dây đeo thẻ", "Bộ Giftset văn phòng"]
      },
      {
        title: "Kỷ Niệm Thành Lập",
        links: ["Kỷ niệm chương pha lê", "Bảng vinh danh gỗ đồng", "Đồng hồ treo tường", "Huy hiệu & Huy chương"]
      },
      {
        title: "Khuyến Mãi & Quảng Cáo",
        links: ["Mũ bảo hiểm", "Áo mưa", "Ô dù cầm tay", "Móc khóa quà tặng", "Quạt nhựa cầm tay"]
      }
    ]
  },
  {
    groupName: "Quà Tặng Đối Tượng",
    items: [
      {
        title: "Đối Tác & Khách Hàng",
        links: ["Bộ ấm chén cao cấp", "Hộp rượu vang", "Tranh mạ vàng", "Bộ quà tặng gốm sứ", "Đặc sản vùng miền"]
      },
      {
        title: "Nhân Viên & Nội Bộ",
        links: ["Cốc sứ in hình", "Gối tựa lưng văn phòng", "Lịch để bàn", "Thẻ quà tặng (Voucher)", "Tiệc Teabreak"]
      },
      {
        title: "Lãnh Đạo & VIP",
        links: ["Bút ký cao cấp (Parker/Picasso)", "Cặp da doanh nhân", "Tượng phong thủy để bàn", "Bộ bàn cờ cao cấp"]
      }
    ]
  }
];

// --- 3. DỮ LIỆU FOOTER (Từ src/components/layout/Footer.tsx) ---
const FOOTER_LINKS = {
  about: {
    title: "Về chúng tôi",
    links: [
      { label: "Giới thiệu LoveGifts", href: "/about" },
      { label: "Tuyển dụng", href: "/careers" },
      { label: "Điều khoản & Chính sách", href: "/terms" },
      { label: "Hợp tác doanh nghiệp", href: "/b2b" },
      { label: "Câu chuyện thương hiệu", href: "/story" },
    ],
  },
  support: {
    title: "Hỗ trợ khách hàng",
    links: [
      { label: "Hướng dẫn mua hàng", href: "/guide" },
      { label: "Phương thức thanh toán", href: "/payment-policy" },
      { label: "Chính sách vận chuyển", href: "/shipping" },
      { label: "Chính sách đổi trả", href: "/returns" },
      { label: "Bảo mật thông tin", href: "/privacy" },
    ],
  },
  policy: {
    title: "Chính sách & Quy định",
    links: [
      { label: "Quy chế hoạt động", href: "/regulations" },
      { label: "Chính sách kiểm hàng", href: "/inspection" },
      { label: "Quyền lợi thành viên", href: "/membership" },
      { label: "Giải quyết khiếu nại", href: "/complaints" },
    ],
  },
};

// --- HÀM MAIN SEEDING ---
async function main() {
  console.log('🌱 Start seeding CMS Content...');

  // 1. Seed Banners
  // Xóa cũ nếu cần thiết (hoặc skip nếu đã có)
  const existingBanners = await prisma.banner.count();
  if (existingBanners === 0) {
     console.log('   - Seeding Banners...');
     for (const slide of [...HERO_SLIDES, ...SUB_HERO_SLIDES]) {
        await prisma.banner.create({ data: slide });
     }
  } else {
     console.log('   - Banners already exist. Skipping.');
  }

  // 2. Seed System Config (Menus)
  console.log('   - Seeding Menus & Navigation...');
  const configs = [
    { key: 'HEADER_CATEGORIES', value: FULL_CATEGORIES, desc: 'Mega Menu Danh Mục Sản Phẩm' },
    { key: 'HEADER_RECIPIENT', value: RECIPIENT_DATA, desc: 'Menu Chọn Quà Theo Người Nhận' },
    { key: 'HEADER_OCCASION', value: OCCASION_DATA, desc: 'Menu Chọn Quà Theo Dịp Lễ' },
    { key: 'HEADER_BUSINESS', value: BUSINESS_GIFT_DATA, desc: 'Menu Quà Tặng Doanh Nghiệp' },
    { key: 'FOOTER_DATA', value: FOOTER_LINKS, desc: 'Cấu hình Link Footer' }
  ];

  for (const conf of configs) {
    await prisma.systemConfig.upsert({
      where: { key: conf.key },
      update: {}, // Không đè nếu đã có (để admin sửa rồi không bị reset)
      create: {
        key: conf.key,
        value: conf.value, // Prisma tự convert object/array sang JSON
        description: conf.desc
      }
    });
  }
  
  console.log('✅ Seeding CMS Content Completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });