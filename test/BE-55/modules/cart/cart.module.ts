// src/cart/cart.module.ts
import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './controllers/cart.controller';

@Module({
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], 
})
export class CartModule {}