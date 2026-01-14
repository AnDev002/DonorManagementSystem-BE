import { IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class UpdateShopProfileDto {
  @IsOptional() // Để optional vì update có thể chỉ update 1 vài trường
  @IsString()
  @MinLength(3, { message: 'Tên Shop phải có ít nhất 3 ký tự' })
  @MaxLength(30, { message: 'Tên Shop tối đa 30 ký tự' })
  @Matches(/^[a-zA-Z0-9\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ_]+$/, {
    message: 'Tên Shop không được chứa ký tự đặc biệt',
  })
  shopName?: string;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // --- CÁC TRƯỜNG ẢNH & GIẤY TỜ (Nhận URL string từ FE) ---
  
  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsString()
  businessLicenseFront?: string;

  @IsOptional()
  @IsString()
  businessLicenseBack?: string;

  @IsOptional()
  @IsString()
  salesLicense?: string;

  @IsOptional()
  @IsString()
  trademarkCert?: string;

  @IsOptional()
  @IsString()
  distributorCert?: string;
}