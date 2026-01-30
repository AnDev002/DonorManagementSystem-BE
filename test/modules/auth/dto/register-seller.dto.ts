// src/modules/auth/dto/register-seller.dto.ts
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class RegisterSellerDto {
  // --- Thông tin User ---
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên người đại diện' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại là bắt buộc' })
  phoneNumber: string;

  // --- Thông tin Shop ---
  @IsString()
  @IsNotEmpty({ message: 'Tên Shop không được để trống' })
  shopName: string;

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ lấy hàng là bắt buộc' })
  pickupAddress: string;

  // --- THÊM MỚI ---
  @IsNumber()
  @Transform(({ value }) => Number(value)) // Convert từ FormData (string) sang Number
  provinceId: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  districtId: number;

  @IsString()
  @IsNotEmpty()
  wardCode: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  lat?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  lng?: number;

  @IsString()
  @IsOptional()
  businessType?: string; // 'personal' | 'company'

  @IsString()
  @IsOptional()
  taxCode?: string;

  @IsOptional()
  @IsString()
  businessLicenseFront?: string;

  @IsOptional()
  @IsString()
  businessLicenseBack?: string;
}