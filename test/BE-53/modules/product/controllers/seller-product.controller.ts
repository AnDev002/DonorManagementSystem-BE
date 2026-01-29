// BE--1/modules/product/controllers/seller-product.controller.ts
import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Query } from '@nestjs/common';
import { ProductWriteService } from '../services/product-write.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('seller/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SELLER)
export class SellerProductController {
  constructor(private readonly productWriteService: ProductWriteService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateProductDto) {
    // FIX: Sử dụng req.user.id thay vì req.user.userId
    return this.productWriteService.create(req.user.id, dto);
  }
  
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    // FIX: Sử dụng req.user.id
    return this.productWriteService.update(id, req.user.id, dto);
  }

  @Get('my-products')
  searchMyProducts(
    @Request() req,
    @Query('search') search: string,
    @Query('limit') limit: string, // Query params thường là string
  ) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.productWriteService.searchMyProducts(req.user.id, search, limitNum);
  }

  @Get()
  getMyProducts(
      @Request() req, 
      @Query('status') status: string
  ) {
    return this.productWriteService.findAllBySeller(req.user.id, status);
  }
}