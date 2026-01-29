import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module'; 

@Module({
  imports: [
    ConfigModule, 
    // 2. SỬA MODULE IMPORT
    DatabaseModule 
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService], 
})
export class PaymentModule {}