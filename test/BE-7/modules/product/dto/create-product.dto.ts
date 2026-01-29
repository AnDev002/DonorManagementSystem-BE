// BE-1.7/modules/product/dto/create-product.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsPositive, IsArray, ValidateNested, IsJSON } from 'class-validator';
import { Type } from 'class-transformer';

// DTO cho nhóm phân loại (VD: Màu sắc -> [Đỏ, Xanh])
export class ProductTierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

// DTO cho từng biến thể SKU (VD: Màu Đỏ - Size S)
export class ProductVariantDto {
  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  sku?: string;

  // [FIX] Thêm trường này để fix lỗi property 'imageUrl' does not exist
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  tierIndex: number[]; // [0, 0] -> Option 0 của Tier 1 + Option 0 của Tier 2
}

export class CreateProductDto {
  // --- Cơ bản ---
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @IsPositive()
  price: number; // Giá hiển thị mặc định

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  // [NEW] Relation ID
  @IsOptional()
  @IsNumber()
  @IsPositive()
  brandId?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[]; // Mảng URL video

  @IsOptional()
  @IsString()
  sizeChart?: string; // URL ảnh hoặc HTML

  // --- Chi tiết & SEO (Thương hiệu, Xuất xứ...) ---

  @IsOptional()
  @IsString()
  origin?: string; // Xuất xứ

  @IsOptional()
  @IsJSON() 
  attributes?: any; // Lưu JSON các thuộc tính khác (Chất liệu, Kiểu dáng...)

  // --- Vận chuyển (Giao diện Shopee bắt buộc nhập) ---
  @IsNumber()
  @Min(0)
  weight: number; // Gram

  @IsNumber()
  @Min(0)
  length: number; // cm

  @IsNumber()
  @Min(0)
  width: number; // cm

  @IsNumber()
  @Min(0)
  height: number; // cm

  // --- Phân loại hàng (Logic 2 cấp) ---
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTierDto)
  tiers?: ProductTierDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variations?: ProductVariantDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  crossSellIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  systemTags?: string[];
}