import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
// [FIX] Sửa đường dẫn import đúng tới JwtAuthGuard
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; 
import { User } from '../../common/decorators/user.decorator';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  create(@User('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.addressService.create(userId, dto);
  }

  @Get()
  findAll(@User('id') userId: string) {
    return this.addressService.findAll(userId);
  }

  @Put(':id')
  update(@User('id') userId: string, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addressService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@User('id') userId: string, @Param('id') id: string) {
    return this.addressService.remove(userId, id);
  }

  @Patch(':id/default')
  setDefault(@User('id') userId: string, @Param('id') id: string) {
    return this.addressService.setDefault(userId, id);
  }
}