import { Module } from '@nestjs/common';
import { FriendService } from './friend.service';
import { FriendController } from './friend.controller';
import { DatabaseModule } from '../../database/database.module';
import { ChatModule } from '../chat/chat.module'; // Import ChatModule để dùng ChatGateway

@Module({
  imports: [DatabaseModule, ChatModule], 
  controllers: [FriendController],
  providers: [FriendService],
})
export class FriendModule {}