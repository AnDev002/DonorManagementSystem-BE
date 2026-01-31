import { Body, Controller, Get, Post, Delete, Param, UseGuards, Request, Query } from '@nestjs/common';
import { FriendService } from './friend.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';
import { FriendRequestDto, HandleRequestDto } from './dto/friend.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  // 1. Gửi lời mời kết bạn
  @Post('request')
  async sendRequest(@Request() req, @Body() dto: FriendRequestDto) {
    // [FIX] Sửa req.user.userId -> req.user.id
    return this.friendService.sendFriendRequest(req.user.id, dto.receiverId);
  }

  // 2. Chấp nhận/Từ chối
  @Post('response')
  async handleRequest(@Request() req, @Body() dto: HandleRequestDto) {
    // [FIX] Sửa req.user.userId -> req.user.id
    return this.friendService.handleFriendRequest(req.user.id, dto.requestId, dto.action);
  }

  // 3. Lấy danh sách bạn bè
  @Get('my-friends')
  async getMyFriends(@Request() req) {
    // [FIX] Sửa req.user.userId -> req.user.id
    return this.friendService.getFriendList(req.user.id);
  }

  // 4. Lấy lời mời đang chờ
  @Get('pending')
  async getPendingRequests(@Request() req) {
    console.log("Current User ID getting pending requests:", req.user.id); // <--- Log ra để kiểm tra
    return this.friendService.getPendingRequests(req.user.id);
  }

  // 5. Tìm kiếm bạn bè
  @Get('search')
  async searchNewFriends(@Request() req, @Query('q') q: string) {
    // [FIX] Sửa req.user.userId -> req.user.id
    return this.friendService.searchUsers(req.user.id, q);
  }

  // 6. Hủy kết bạn
  @Delete(':friendId')
  async unfriend(@Request() req, @Param('friendId') friendId: string) {
    // [FIX] Sửa req.user.userId -> req.user.id
    return this.friendService.unfriend(req.user.id, friendId);
  }
}