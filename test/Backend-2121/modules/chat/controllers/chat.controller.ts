import { Controller, Get, Patch, Param, Query, UseGuards, Request, Post, Body, Req } from '@nestjs/common';
import { ChatService } from '../chat.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { OpenChatDto } from '../dto/chat.dto';
import { CreateMessageDto } from '../dto/create-message.dto'; 
import { Public } from 'src/common/decorators/public.decorator';

@Controller('chat')
// @UseGuards(JwtAuthGuard) // Bạn đang comment global guard, nên phải gắn lẻ từng cái
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @Public()
  async sendMessage(@Request() req, @Body() dto: CreateMessageDto) {
    const userId = req.user?.userId || null;
    return this.chatService.processUserMessage(userId, dto);
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  getConversations(@Request() req) {
    return this.chatService.getUserConversations(req.user.userId);
  }

  @Get('messages/:conversationId')
  @UseGuards(JwtAuthGuard)
  getMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
  ) {
      return this.chatService.getMessages(conversationId, Number(limit) || 20, cursor);
  }

  @Patch('read/:conversationId')
  @UseGuards(JwtAuthGuard) // [Nên thêm Guard cho chắc chắn]
  markAsRead(@Request() req, @Param('conversationId') conversationId: string) {
    return this.chatService.markAsRead(conversationId, req.user.userId);
  }

  @Post('open-chat')
  @UseGuards(JwtAuthGuard) // <--- [FIX] THÊM DÒNG NÀY
  async openChat(@Request() req, @Body() dto: OpenChatDto) {
    // Bây giờ req.user đã tồn tại nhờ JwtAuthGuard
    console.log('Open Chat Request:', dto); 
    return this.chatService.findOrCreateConversation(req.user.userId, dto.receiverId);
  }

  @Get('users/search')
  @UseGuards(JwtAuthGuard) // [Nên thêm Guard vì bên trong dùng req.user]
  async searchUsers(@Query('q') q: string, @Req() req: any) {
    const userId = req.user.userId; 
    if (!q) return [];
    return this.chatService.searchUsers(q, userId);
  }
}