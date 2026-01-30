import { IsArray, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class FlashSaleItemDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;
  

  @IsNotEmpty()
  @IsUUID()
  variantId: string;

  @IsNumber()
  @Min(1000)
  promoPrice: number;

  @IsNumber()
  @Min(1)
  promoStock: number;

  @IsNumber()
  @Min(0) // Giá không được âm
  price: number; // Giá bán Flash Sale

  @IsNumber()
  @Min(1) // Số lượng đăng ký bán ít nhất là 1
  stock: number;
}

export class RegisterFlashSaleDto {
  @IsNotEmpty()
  @IsUUID()
  sessionId: string;

  @IsArray()
  items: FlashSaleItemDto[];
}