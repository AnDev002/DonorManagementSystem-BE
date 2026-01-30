// src/modules/auth/dto/register-seller.dto.ts
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, IsNumber, Matches, MaxLength, IsUrl } from 'class-validator';

export class RegisterSellerDto {
  // --- Thông tin User ---
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { 
    message: 'Mật khẩu phải có chữ hoa, chữ thường và số/ký tự đặc biệt' 
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Họ tên quá ngắn' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại là bắt buộc' })
  phoneNumber: string;

  // --- Thông tin Shop ---
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Tên Shop phải từ 5 ký tự trở lên' })
  @MaxLength(50, { message: 'Tên Shop tối đa 50 ký tự' })
  @Matches(/^[a-zA-Z0-9\s\u00C0-\u1EF9]+$/, {
      message: 'Tên Shop không được chứa ký tự đặc biệt'
  })
  shopName: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn ngành hàng kinh doanh' })
  categoryId: string; // Thêm trường này

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
  @Matches(/^[0-9]{10}$|^[0-9]{13}$/, {
      message: 'Mã số thuế/CCCD không hợp lệ'
  })
  taxCode?: string;

  @IsNotEmpty({ message: 'Ảnh mặt trước là bắt buộc' })
  @IsUrl({}, { message: 'URL ảnh mặt trước không hợp lệ' })
  businessLicenseFront?: string;

  @IsNotEmpty({ message: 'Ảnh mặt sau là bắt buộc' })
  @IsUrl({}, { message: 'URL ảnh mặt sau không hợp lệ' })
  businessLicenseBack?: string;
  
}