import { Module } from '@nestjs/common';
import { HomeSettingsController } from './home-settings.controller';
import { HomeSettingsService } from './home-settings.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CategoryModule } from '../category/category.module';
import { DatabaseModule } from 'src/database/database.module';
@Module({
  imports: [
      DatabaseModule, 
      CategoryModule // <--- THÊM VÀO IMPORTS
  ],
  controllers: [HomeSettingsController],
  providers: [HomeSettingsService, PrismaService],
  exports: [HomeSettingsService]
})
export class HomeSettingsModule {}