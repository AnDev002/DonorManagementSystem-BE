import { Controller, Get, Patch, Param, Query, UseGuards, Request, Body, Post } from '@nestjs/common';
import { AdminUsersService } from '../admin-users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { User } from 'src/common/decorators/user.decorator';
import { CreateUserDto, ToggleBanUserDto } from '../dto/admin-users.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Chỉ ADMIN mới được truy cập Controller này
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}


  @Get('sellers')
  async getSellers(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
  ) {
    return this.adminUsersService.getSellers({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
    });
  }

  @Patch(':id/ban-status')
  async toggleBan(
    @Request() req, 
    @Param('id') id: string, 
    @Body() body: { isBanned: boolean; reason?: string }
  ) {
    // SỬA: Gọi toggleBanShop
    return this.adminUsersService.toggleBanShop(req.user.userId, id, body.isBanned, body.reason);
  }

  @Get() 
  async getUsers(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('role') role: string,
  ) {
    return this.adminUsersService.getAllUsers({ 
      page: Number(page) || 1, 
      limit: Number(limit) || 10,
      search,
      role
    });
  }

  @Post()
  createUser(@User('userId') adminId: string, @Body() dto: CreateUserDto) {
    return this.adminUsersService.createUser(adminId, dto);
  }

  // 3. [NEW] Khóa / Mở khóa User
  @Patch(':id/ban')
  toggleBanUser(
    @User('userId') adminId: string,
    @Param('id') userId: string,
    @Body() dto: ToggleBanUserDto,
  ) {
    return this.adminUsersService.toggleBanUser(adminId, userId, dto.isBanned, dto.reason);
  }

  @Get('pending-shops')
  async getPendingShops(
    @Query('page') page: number,
    @Query('limit') limit: number
  ) {
    // SỬA: Gọi getPendingShops thay vì getPendingSellers
    
    return this.adminUsersService.getPendingShops(Number(page) || 1, Number(limit) || 10);
  }

  @Patch(':id/approve')
  async approveShop(@Request() req, @Param('id') shopId: string) {
    // SỬA: Gọi approveShop
    return this.adminUsersService.approveShop(req.user.userId, shopId);
  }

  @Patch(':id/reject')
  async rejectShop(@Request() req, @Param('id') shopId: string, @Body() body: { reason: string }) {
    // SỬA: Gọi rejectShop
    return this.adminUsersService.rejectShop(req.user.userId, shopId, body.reason);
  }
}