import { IsBoolean, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsObject, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }) 
  isBuyNow: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items?: CartItemDto[];

  // [SỬA] Đổi từ voucherId sang voucherIds (mảng)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  voucherIds?: string[];

  @IsOptional()
  @IsBoolean()
  useCoins?: boolean;

  @IsOptional()
  @IsBoolean()
  isGift?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsOptional()
  @IsNumber()
  giftWrapIndex?: number;

  @IsOptional()
  @IsNumber()
  cardIndex?: number;

  @IsOptional()
  @IsObject()
  senderInfo?: any;

  @IsOptional()
  @IsObject()
  receiverInfo?: any;
  
  @IsOptional()
  @IsNumber()
  totalAmount?: number;
}