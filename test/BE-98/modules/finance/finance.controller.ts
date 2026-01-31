import { Controller, Get, Patch, Query, Param, UseGuards, Body } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // 1. Lấy thống kê doanh thu (Revenue Stats)
  @Get('revenue')
  async getRevenueStats(@Query('period') period: string) {
    return this.financeService.getRevenueStats(period);
  }

  // 2. Lấy danh sách yêu cầu rút tiền
  @Get('payouts')
  async getPayoutRequests(
    @Query('page') page: string,
    @Query('status') status: string
  ) {
    return this.financeService.getPayoutRequests(Number(page) || 1, status);
  }

  // 3. Duyệt yêu cầu rút tiền
  @Patch('payouts/:id/approve')
  async approvePayout(@Param('id') id: string) {
    return this.financeService.approvePayout(id);
  }

  // 4. Từ chối yêu cầu rút tiền
  @Patch('payouts/:id/reject')
  async rejectPayout(@Param('id') id: string, @Body('reason') reason: string) {
    return this.financeService.rejectPayout(id, reason);
  }
}