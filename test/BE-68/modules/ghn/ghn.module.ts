import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GhnService } from './ghn.service';
import { GhnController } from './ghn.controller';

@Module({
  imports: [HttpModule],
  controllers: [GhnController],
  providers: [GhnService],
  exports: [GhnService],
})
export class GhnModule {}