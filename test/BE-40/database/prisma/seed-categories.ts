import { PrismaClient, ProductStatus, Role, Shop, ShopCategory, ProductOption, ProductOptionValue } from '@prisma/client';
import { fakerVI as faker } from '@faker-js/faker';
import slugify from 'slugify';

const prisma = new PrismaClient();

// Helper tạo slug chuẩn tiếng Việt
const createSlug = (name: string) => slugify(name, { lower: true, locale: 'vi', remove: /[*+~.()'"!:@]/g }) + '-' + Date.now();

// Ảnh mẫu demo
const PRODUCT_IMAGES = [
  "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lmzzm22jdz2ub0.webp",
  "https://down-bs-vn.img.susercontent.com/vn-11134207-7qukw-ljz616524jiy56.webp",
  "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lon94843477j68.webp",
  "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lon948435lrz44.webp",
  "https://down-bs-vn.img.susercontent.com/vn-11134207-7r98o-lmzzm22jevmad6.webp",
  "https://down-vn.img.susercontent.com/file/sg-11134201-22100-2442432423ivd5",
];

// CẤU TRÚC DANH MỤC 4 CẤP
const CATEGORY_TREES = [
  {
    name: "Sức khỏe & Sắc đẹp",
    children: [
      {
        name: "Chăm sóc răng miệng",
        children: [
          {
            name: "Bàn chải",
            children: ["Bàn chải điện", "Bàn chải thường", "Đầu bàn chải thay thế", "Máy tăm nước"]
          },
          {
            name: "Kem đánh răng",
            children: ["Làm trắng răng", "Cho răng nhạy cảm", "Hương thảo dược"]
          }
        ]
      },
      {
        name: "Chăm sóc da mặt",
        children: [
          {
            name: "Làm sạch",
            children: ["Sữa rửa mặt", "Tẩy trang", "Tẩy tế bào chết"]
          }
        ]
      }
    ]
  },
  {
    name: "Thiết bị điện tử",
    children: [
      {
        name: "Điện thoại & Phụ kiện",
        children: [
          {
            name: "Điện thoại di động",
            children: ["Apple", "Samsung", "Xiaomi", "Oppo"]
          },
          {
            name: "Phụ kiện",
            children: ["Ốp lưng", "Kính cường lực", "Cáp sạc"]
          }
        ]
      }
    ]
  },
  {
    name: "Thời trang Nam",
    children: [
      {
        name: "Áo",
        children: [
          {
            name: "Áo thun",
            children: ["Áo thun ngắn tay", "Áo thun dài tay", "Áo Polo"]
          }
        ]
      }
    ]
  }
];

const KEYWORDS_PREFIX = ["Siêu Rẻ", "Xả Kho", "Chính Hãng", "Cao Cấp", "[Mã giảm 50k]", "Hot Trend", "Freeship"];

async function main() {
  console.log('🚀 Bắt đầu seed dữ liệu Shopee 4 Cấp...');

  // 1. Clean Data cũ
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productOptionValue.deleteMany();
  await prisma.productOption.deleteMany();
  await prisma.product.deleteMany();
  await prisma.shopCategory.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  // 2. Tạo Danh mục 4 Cấp
  console.log('📦 Đang tạo cấu trúc danh mục 4 cấp...');
  const leafCategoryIds: string[] = [];

  for (const l1 of CATEGORY_TREES) {
    const cat1 = await prisma.category.create({
      data: { name: l1.name, slug: createSlug(l1.name), image: faker.image.urlLoremFlickr({ category: 'fashion' }) }
    });

    if (l1.children) {
      for (const l2 of l1.children) {
        const cat2 = await prisma.category.create({
          data: { name: l2.name, slug: createSlug(l2.name), parentId: cat1.id }
        });

        if (l2.children) {
          for (const l3 of l2.children) {
            const cat3 = await prisma.category.create({
              data: { name: l3.name, slug: createSlug(l3.name), parentId: cat2.id }
            });

            if (l3.children) {
              for (const l4Name of l3.children) {
                const cat4 = await prisma.category.create({
                  data: { name: l4Name, slug: createSlug(l4Name), parentId: cat3.id }
                });
                leafCategoryIds.push(cat4.id);
              }
            } else {
                leafCategoryIds.push(cat3.id);
            }
          }
        }
      }
    }
  }

  // 3. Tạo Seller & Shop
  console.log('🏪 Đang tạo 10 Shop & Seller...');
  
  // [FIX LỖI TS2345]: Định nghĩa kiểu dữ liệu cho mảng shops
  // Shops bao gồm thông tin Shop + quan hệ ShopCategory[]
  const shops: (Shop & { shopCategories: ShopCategory[] })[] = [];

  for (let i = 0; i < 10; i++) {
    const user = await prisma.user.create({
      data: {
        email: `seller${i}@shopee.fake`,
        name: faker.person.fullName(),
        password: 'password123', 
        role: Role.SELLER,
        isVerified: true,
        phone: faker.phone.number(),
        avatar: faker.image.avatar(),
        walletBalance: 0,
      }
    });

    const shop = await prisma.shop.create({
      data: {
        name: faker.company.name() + (i % 2 === 0 ? " Official Store" : " Mall"),
        slug: createSlug(faker.company.name()),
        ownerId: user.id,
        avatar: faker.image.urlLoremFlickr({ category: 'business' }),
        coverImage: faker.image.urlLoremFlickr({ category: 'nature' }),
        description: faker.lorem.paragraph(),
        status: 'ACTIVE',
        rating: faker.number.float({ min: 4.2, max: 5.0, fractionDigits: 1 }),
        totalSales: faker.number.int({ min: 500, max: 100000 }),
        pickupAddress: faker.location.streetAddress() + ", TP.HCM",
        shopCategories: {
            create: [{ name: "Sản phẩm mới" }, { name: "Sale sập sàn" }]
        }
      },
      include: { shopCategories: true }
    });
    shops.push(shop);
  }

  // 4. Tạo Sản phẩm
  console.log('👕 Đang tạo 300 sản phẩm...');
  
  for (const shop of shops) {
    for (let j = 0; j < 30; j++) {
      const categoryId = faker.helpers.arrayElement(leafCategoryIds);
      const prefix = faker.helpers.arrayElement(KEYWORDS_PREFIX);
      const baseName = faker.commerce.productName();
      const productName = `${prefix} ${baseName} ${faker.commerce.productAdjective()}`;

      const originalPrice = Number(faker.commerce.price({ min: 50000, max: 5000000 }));
      const price = Math.floor(originalPrice * 0.7);
      const hasVariants = Math.random() > 0.2;

      const product = await prisma.product.create({
        data: {
          name: productName,
          slug: createSlug(productName),
          description: faker.commerce.productDescription() + "\n\n" + faker.lorem.paragraphs(2),
          price: price,
          originalPrice: originalPrice,
          stock: faker.number.int({ min: 50, max: 1000 }),
          images: JSON.stringify(faker.helpers.arrayElements(PRODUCT_IMAGES, faker.number.int({ min: 3, max: 5 }))), 
          status: ProductStatus.ACTIVE,
          salesCount: faker.number.int({ min: 10, max: 5000 }),
          rating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
          categoryId: categoryId,
          shopId: shop.id,
          sellerId: shop.ownerId,
          shopCategoryId: faker.helpers.arrayElement(shop.shopCategories)?.id,
          attributes: JSON.stringify({
            brand: "No Brand",
            origin: "Việt Nam",
            warranty: "12 Tháng"
          }),
        }
      });

      if (hasVariants) {
        const option1 = await prisma.productOption.create({
          data: {
            productId: product.id,
            name: Math.random() > 0.5 ? "Màu sắc" : "Kiểu dáng",
            position: 0,
            values: {
              create: [
                { value: "Cơ bản", image: PRODUCT_IMAGES[0], position: 0 },
                { value: "Cao cấp", image: PRODUCT_IMAGES[1], position: 1 }
              ]
            }
          },
          include: { values: true }
        });

        // [FIX LỖI TS2322 & TS2339]: Định nghĩa kiểu cho option2
        let option2: (ProductOption & { values: ProductOptionValue[] }) | null = null;
        
        if (Math.random() > 0.5) {
            option2 = await prisma.productOption.create({
                data: {
                    productId: product.id,
                    name: "Kích cỡ",
                    position: 1,
                    values: {
                        create: [
                            { value: "Nhỏ", position: 0 },
                            { value: "Lớn", position: 1 }
                        ]
                    }
                },
                include: { values: true }
            });
        }

        if (!option2) {
            for (const val1 of option1.values) {
                await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        price: price,
                        stock: faker.number.int({min: 10, max: 50}),
                        sku: `${product.id.slice(0,5)}-${val1.value}`,
                        tierIndex: `${val1.position}`
                    }
                });
            }
        } else {
            for (const val1 of option1.values) {
                // TypeScript bây giờ đã biết option2 không null ở đây
                for (const val2 of option2.values) {
                    await prisma.productVariant.create({
                        data: {
                            productId: product.id,
                            price: price + (val2.position * 10000),
                            stock: faker.number.int({min: 10, max: 50}),
                            sku: `${product.id.slice(0,5)}-${val1.value}-${val2.value}`,
                            tierIndex: `${val1.position},${val2.position}`
                        }
                    });
                }
            }
        }
      }
    }
    console.log(`   -> Đã seed xong Shop: ${shop.name}`);
  }

  console.log('✅ Seed hoàn tất!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });