import { Module } from '@nestjs/common';
import { HomeSettingsController } from './home-settings.controller';
import { HomeSettingsService } from './home-settings.service';
import { PrismaService } from '../../database/prisma/prisma.service';

@Module({
  controllers: [HomeSettingsController],
  providers: [HomeSettingsService, PrismaService],
})
export class HomeSettingsModule {}