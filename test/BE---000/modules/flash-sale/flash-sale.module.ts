// BE-3.7/modules/flash-sale/flash-sale.module.ts
import { Module } from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import { FlashSaleController } from './flash-sale.controller';
import { PrismaService } from '../../database/prisma/prisma.service';

@Module({
  controllers: [FlashSaleController],
  providers: [FlashSaleService, PrismaService],
})
export class FlashSaleModule {}