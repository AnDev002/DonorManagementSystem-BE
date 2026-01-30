// src/tracking/tracking.module.ts
import { Module } from '@nestjs/common';
import { TrackingController } from './controllers/tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingProcessor } from './tracking.processor'; // Nếu bạn dùng Worker

@Module({
  controllers: [TrackingController],
  providers: [TrackingService, TrackingProcessor],
  exports: [TrackingService], // Export nếu module khác cần dùng
})
export class TrackingModule {}