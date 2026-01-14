// BE-3.7/modules/flash-sale/flash-sale.controller.ts
import { 
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards 
} from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import { CreateFlashSaleSessionDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleSessionDto } from './dto/update-flash-sale.dto';
import { Roles } from '../../common/decorators/roles.decorator'; // Giả định bạn có custom decorator này
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/flash-sale')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Chỉ Admin mới được truy cập
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Post('sessions')
  create(@Body() createDto: CreateFlashSaleSessionDto) {
    return this.flashSaleService.createSession(createDto);
  }

  @Get('sessions')
  findAll(@Query('date') date?: string) {
    return this.flashSaleService.findAll(date);
  }

  @Patch('sessions/:id')
  update(
    @Param('id') id: string, 
    @Body() updateDto: UpdateFlashSaleSessionDto
  ) {
    return this.flashSaleService.update(id, updateDto);
  }

  @Delete('sessions/:id')
  remove(@Param('id') id: string) {
    return this.flashSaleService.remove(id);
  }
}