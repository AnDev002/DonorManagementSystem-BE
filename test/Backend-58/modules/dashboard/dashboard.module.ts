// modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule], // Import để dùng PrismaService
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}