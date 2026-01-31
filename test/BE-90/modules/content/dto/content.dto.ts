import { IsString, IsOptional, IsInt, IsBoolean, IsArray, ValidateNested, IsObject, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

// DTO cho Banner
export class CreateBannerDto {
  @IsString()
  location: string;

  @IsString()
  src: string;

  @IsOptional() @IsString()
  alt?: string;

  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  ctaLabel?: string;

  @IsOptional() @IsString()
  ctaLink?: string;

  @IsOptional() @IsString()
  theme?: string;

  @IsOptional() @IsInt()
  order?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto extends CreateBannerDto {}

// DTO cho Reorder
class ReorderItem {
  @IsString()
  id: string;

  @IsInt()
  order: number;
}

export class ReorderBannersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[]; // Khớp với items: { id, order }[] ở FE
}

// DTO cho Config
export class SaveConfigDto {
  @IsString()
  key: string;

  @IsNotEmpty()
  value: any;
}