// src/modules/category/dto/update-category-order.dto.ts

import { IsArray, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCategoryOrderDto {
  @IsString()
  @IsOptional()
  // ID của danh mục cha. Nếu null (root level), frontend có thể gửi null hoặc không gửi.
  parentId?: string | null;

  @IsArray()
  @IsString({ each: true })
  // Danh sách ID các category đã được sắp xếp lại
  orderedIds: string[];
}