// BE-3.7/modules/flash-sale/dto/create-flash-sale-session.dto.ts
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { FlashSaleStatus } from '@prisma/client';

export class CreateFlashSaleSessionDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsEnum(FlashSaleStatus)
  status?: FlashSaleStatus;
}
