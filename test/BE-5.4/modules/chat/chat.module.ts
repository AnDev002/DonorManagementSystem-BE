import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './controllers/chat.controller';
import { AiService } from './ai.service';
import { GiftConsultantService } from './gift-consultant.service';
import { ProductModule } from '../product/product.module'; 
import { DatabaseModule } from '../../database/database.module'; 
import { AuthModule } from '../auth/auth.module'; // <--- 1. Import AuthModule

@Module({
  imports: [
    ProductModule,
    DatabaseModule,
    AuthModule // <--- 2. Thêm vào mảng imports
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway, 
    ChatService, 
    AiService, 
    GiftConsultantService 
  ],
  exports: [ChatService, ChatGateway]
})
export class ChatModule {}