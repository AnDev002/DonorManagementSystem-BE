// modules/admin-users/dto/admin-user.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsEnum, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Username phải có ít nhất 4 ký tự' })
  username?: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class ToggleBanUserDto {
  @IsNotEmpty()
  @IsBoolean()
  isBanned: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}