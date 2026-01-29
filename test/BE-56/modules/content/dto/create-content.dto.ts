// Backend/modules/content/dto/create-content.dto.ts
import { IsBoolean, IsInt, IsOptional, IsString, IsObject, IsNotEmpty } from 'class-validator';

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

export class UpdateConfigDto {
  @IsString()
  key: string;

  @IsNotEmpty()
  value: any; // JSON Object cho menu/footer
}