import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { VoucherType, VoucherScope } from '@prisma/client';

export class CreateVoucherDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(VoucherType)
  type: VoucherType;

  @IsEnum(VoucherScope)
  scope: VoucherScope;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  @Min(1)
  usageLimit: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString({ each: true })
  productIds?: string[];

  // --- BỔ SUNG 2 TRƯỜNG NÀY ---
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;
  // ----------------------------

  @IsOptional()
  @IsString({ each: true })
  categoryIds?: string[];
}