// src/modules/auth/dto/register-seller.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

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

  @IsString()
  @IsOptional()
  businessType?: string; // 'personal' | 'company'

  @IsString()
  @IsOptional()
  taxCode?: string;
}