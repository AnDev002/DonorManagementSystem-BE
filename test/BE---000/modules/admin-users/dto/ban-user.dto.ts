import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BanUserDto {
  @IsBoolean()
  @IsNotEmpty()
  isBanned: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}