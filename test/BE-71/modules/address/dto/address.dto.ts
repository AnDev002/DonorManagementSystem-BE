import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  specificAddress: string;

  @IsInt()
  @IsNotEmpty()
  provinceId: number;

  @IsInt()
  @IsNotEmpty()
  districtId: number;

  @IsString()
  @IsNotEmpty()
  wardCode: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}