// src/auth/dto/auth.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, Length } from 'class-validator';

// Dùng cho Đăng ký
export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  name: string;
}

export class RegisterSellerDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên Shop' })
  shopName: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  phoneNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ lấy hàng' })
  pickupAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập Mã số thuế/CCCD' })
  taxCode: string;
}

// Dùng cho Đăng nhập
export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password: string;
}

// Dùng cho Quên mật khẩu / Gửi lại OTP
export class SendOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;
}

// Dùng cho Xác thực OTP
export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có 6 ký tự' })
  otp: string;
}