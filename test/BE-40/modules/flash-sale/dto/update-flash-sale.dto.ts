// BE-3.7/modules/flash-sale/dto/update-flash-sale-session.dto.ts
import { PartialType } from '@nestjs/swagger'; // Hoặc @nestjs/mapped-types
import { CreateFlashSaleSessionDto } from './create-flash-sale.dto';

export class UpdateFlashSaleSessionDto extends PartialType(CreateFlashSaleSessionDto) {}