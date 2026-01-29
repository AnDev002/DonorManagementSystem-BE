import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
// SỬA DÒNG NÀY: Dùng đường dẫn đúng (lùi 1 cấp) hoặc đường dẫn tuyệt đối
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; 
// Hoặc an toàn hơn: import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';

import { RolesGuard } from '../../common/guards/roles.guard'; // Nếu file này cũng báo lỗi tương tự, hãy sửa thành '../common/guards/roles.guard' nếu common ngang cấp với modules
// Kiểm tra lại đường dẫn RolesGuard:
// Nếu 'common' nằm trong 'src/common' và 'dashboard' nằm trong 'src/modules/dashboard':
// path đúng là: '../../common/guards/roles.guard' (modules -> src -> common)

import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }
}