import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { GhnModule } from '../ghn/ghn.module'; // <--- 1. Import GhnModule

@Module({
  imports: [
    GhnModule, // <--- 2. Thêm GhnModule vào mảng imports
  ],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService]
})
export class AddressModule {}