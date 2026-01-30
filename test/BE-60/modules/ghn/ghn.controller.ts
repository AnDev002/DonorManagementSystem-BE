import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GhnService } from './ghn.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('ghn')
export class GhnController {
  constructor(private readonly ghnService: GhnService) {}

  @Post('calculate-fee')
  async calculateFee(@Body() body: { toDistrictId: number; toWardCode: string; weight: number; insuranceValue: number }) {
    const total = await this.ghnService.calculateFee(body);
    return { total };
  }

  @Post('calculate-time')
  async calculateTime(@Body() body: { toDistrictId: number; toWardCode: string }) {
    const leadtimeTimestamp = await this.ghnService.calculateExpectedDeliveryTime(body);
    return { leadtime: leadtimeTimestamp };
  }

  @Public()
  @Get('provinces')
  async getProvinces() {
    return this.ghnService.getProvinces();
  }

  @Public()
  @Get('districts')
  async getDistricts(@Query('province_id') provinceId: string) {
    return this.ghnService.getDistricts(Number(provinceId));
  }

  @Public()
  @Get('wards')
  async getWards(@Query('district_id') districtId: string) {
    return this.ghnService.getWards(Number(districtId));
  }
}