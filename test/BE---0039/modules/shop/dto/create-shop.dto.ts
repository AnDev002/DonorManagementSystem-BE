// src/modules/shop/dto/create-shop.dto.ts
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

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

  @IsNotEmpty({ message: 'Province ID là bắt buộc' })
  @IsNumber()
  @Transform(({ value }) => Number(value)) // Đảm bảo convert sang số nếu gửi từ FormData
  provinceId: number;

  @IsNotEmpty({ message: 'District ID là bắt buộc' })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  districtId: number;

  @IsNotEmpty({ message: 'Ward Code là bắt buộc' })
  @IsString()
  wardCode: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : 0)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : 0)
  lng?: number;
}