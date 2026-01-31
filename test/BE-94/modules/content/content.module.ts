// Backend/modules/content/content.module.ts
import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { PrismaService } from '../../database/prisma/prisma.service';

@Module({
  controllers: [ContentController],
  providers: [ContentService, PrismaService],
  exports: [ContentService],
})
export class ContentModule {}