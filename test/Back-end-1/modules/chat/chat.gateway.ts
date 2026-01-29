import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer 
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io'; // Import Server
import { GiftConsultantService } from './gift-consultant.service';
import { ChatService } from './chat.service'; // Import ChatService
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt'; // Cần để verify token lấy userId
import * as cookie from 'cookie';

function parseCookie(str: string) {
  return str
    .split(';')
    .map(v => v.split('='))
    .reduce((acc, v) => {
      acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      return acc;
    }, {});
}

@WebSocketGateway({ 
  cors: {
    origin: true, // Hoặc domain frontend cụ thể
    credentials: true // QUAN TRỌNG: Phải khớp với frontend
  }
 })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server; // Inject Server instance để emit tới room cụ thể

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly giftService: GiftConsultantService,
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService // Inject JwtService (cần import trong ChatModule)
  ) {}

  async handleConnection(client: Socket) {
    try {
        console.log(`\n--- [DEBUG] New Connection Attempt: ${client.id} ---`);
        
        let token = client.handshake.auth.token;
        const cookieString = client.handshake.headers.cookie;

        console.log('1. Cookie String:', cookieString); // Xem cookie có được gửi lên không

        if (!token && cookieString) {
            const cookies = parseCookie(cookieString);
            // In ra toàn bộ key cookie để xem bạn đang dùng tên gì
            console.log('2. Parsed Cookies Keys:', Object.keys(cookies)); 
            
            // Kiểm tra tên cookie chính xác
            token = cookies['Authentication'] || cookies['accessToken'] || cookies['access_token']; 
        }

        if (!token) {
            console.log('❌ No Token found -> Guest Mode');
            return;
        }

        const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
        // Kiểm tra xem payload giải mã ra cái gì
        console.log('3. Decoded Payload:', payload);

        const userId = payload.userId || payload.sub || payload.id; 

        if (!userId) {
            console.log('❌ Token valid but UserID is missing in payload');
            client.disconnect();
            return;
        }

        // QUAN TRỌNG: Kiểm tra xem đã join đúng room chưa
        client.join(`user_${userId}`);
        client.data.userId = userId;

        console.log(`✅ SUCCESS: User ${userId} joined room "user_${userId}"`);
        
        // In ra danh sách các room mà socket này đang join
        console.log('   Current Rooms:', client.rooms);

    } catch (e) {
        console.error('❌ Connection Error:', e.message);
        client.disconnect();
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.userId;
    console.log(`\n--- [DEBUG] Handle Message from ${senderId} ---`);
    console.log('Payload:', data);

    if (!senderId) {
        console.log('❌ Sender not identified (Not logged in)');
        client.emit('error', { message: 'Unauthorized' });
        return;
    }

    // ... (Giữ code logic cũ)

    try {
        const savedMessage = await this.chatService.sendMessage(senderId, {
            content: data.content,
            receiverId: data.receiverId,
            type: (data.type as any) || 'TEXT'
        });

        const payload = {
            id: savedMessage.id,
            conversationId: savedMessage.conversationId, // <--- Bắt buộc có cái này
            senderId: senderId,
            content: savedMessage.content,
            type: savedMessage.type,
            timestamp: savedMessage.createdAt,
            sender: savedMessage.sender
        };

        // 2. Gửi cho NGƯỜI NHẬN (Seller)
        this.server.to(`user_${data.receiverId}`).emit('receive_message', payload);

        // 3. [SỬA LẠI] Gửi lại cho NGƯỜI GỬI (User) dùng chung event 'receive_message'
        // Thay vì 'message_sent_success', hãy dùng 'receive_message'
        client.emit('receive_message', payload);

    } catch (e) {
        console.error('❌ Error processing message:', e);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}