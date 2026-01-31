import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductReviewItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SubmitOrderReviewDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  shopRating: number;

  @IsOptional()
  @IsString()
  shopComment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductReviewItemDto)
  productReviews: ProductReviewItemDto[];
}