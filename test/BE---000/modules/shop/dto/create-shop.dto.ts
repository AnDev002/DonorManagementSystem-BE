// src/modules/shop/dto/create-shop.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateShopDto {
  @IsNotEmpty({ message: 'Tên Shop không được để trống' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Địa chỉ lấy hàng không được để trống' })
  @IsString()
  pickupAddress: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;
}