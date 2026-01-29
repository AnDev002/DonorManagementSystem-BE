// src/tracking/tracking.controller.ts
import { Body, Controller, Post, Get, UseGuards, Request, Headers, Ip, Query } from '@nestjs/common';
import { TrackingService } from '../tracking.service';
import { TrackBatchDto } from '../dto/track-event.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('tracking')
export class TrackingController {
    constructor(private readonly trackingService: TrackingService) {}

    @Post('batch')
    @Public()
    @UseGuards(JwtAuthGuard)
    async trackBatch(
      @Request() req, 
      @Body() body: TrackBatchDto,
      @Headers('x-device-id') headerDeviceId: string,
      @Query('deviceId') queryDeviceId: string, // Support Beacon API
      @Headers('user-agent') userAgent: string,
      @Ip() ip: string
    ) {
        const userId = req.user?.userId || null;
        // Ưu tiên Header, fallback sang Query param (do Beacon gửi)
        const guestId = headerDeviceId || queryDeviceId || 'unknown_device';
        
        if (body.events && body.events.length > 0) {
          const enrichedEvents = body.events.map(event => ({
             ...event,
             userId, // Gán userId server-side cho chắc chắn
             guestId,
             metadata: {
                 ...event.metadata,
                 ip,
                 userAgent,
             }
          }));

          Promise.all(enrichedEvents.map(event => 
              this.trackingService.trackEvent(userId, guestId, event)
          )).catch(err => console.error("Tracking Push Error:", err.message));
        }
        
        return { success: true };
    }

    @Get('recommendations')
    @Public()
    @UseGuards(JwtAuthGuard)
    async getRecommendations(
        @Request() req,
        @Headers('x-device-id') deviceId: string
    ) {
        const userId = req.user?.userId || null;
        const guestId = deviceId || 'unknown_device';

        // Lấy danh sách ID sản phẩm phù hợp
        const productIds = await this.trackingService.getRecommendations(userId, guestId);
        return { productIds };
    }
}