import { Controller, Post, Body, UseGuards, Delete, Query } from '@nestjs/common';
import { R2Service } from './r2.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('storage')
export class StorageController {
  constructor(private readonly r2Service: R2Service) {}

  @Public()
  @Post('presigned')
  @UseGuards(JwtAuthGuard) 
  async getPresignedUrl(@Body() body: { fileName: string; fileType: string }) {
    return this.r2Service.generatePresignedUrl(body.fileName, body.fileType);
  }

  @Post('presigned-url')
  @UseGuards(JwtAuthGuard) // Chỉ user login mới được upload
  async getUploadUrl(@Body() body: { fileName: string; fileType: string; folder?: string }) {
    return await this.r2Service.generatePresignedUrl(body.fileName, body.fileType, body.folder);
  }
}