import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { EncryptionUtil } from 'src/common/utils/encryption.util';
import { CreateMessageDto } from './dto/create-message.dto';
import { AiService } from './ai.service';
import { MessageType } from './dto/create-message.dto';
@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService // Inject AI Service
  ) {}

  // --- SOCKET LOGIC ---
  async getAiHistory(userId: string, limit: number = 6) {
    // 1. Tìm Conversation giữa User và AI
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: userId } } },
          { participants: { some: { id: 'AI_ASSISTANT' } } }, // Giả sử ID của AI trong DB là AI_ASSISTANT
        ],
      },
      select: { id: true }
    });

    if (!conversation) return [];

    // 2. Lấy tin nhắn dựa trên conversationId
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id
      },
      take: limit,
      orderBy: { createdAt: 'desc' }, // Lấy mới nhất
      include: {
        sender: { select: { id: true, role: true } } 
      }
    });

    // 3. Đảo ngược & Giải mã
    return messages.reverse().map(msg => {
        try {
            return { 
                ...msg, 
                content: EncryptionUtil.decrypt(msg.content) 
            };
        } catch (e) { return msg; }
    });
  }
  async processUserMessage(userId: string | null, dto: CreateMessageDto) {
    if (!userId) {
      if (dto.receiverId === 'AI_ASSISTANT') {
        const guestHistory = dto['history'] || []; 
        const aiResponse = await this.aiService.getAiResponse('guest', dto.content, guestHistory);
        
        return {
          userMessage: { 
              id: Date.now().toString(), 
              content: dto.content, 
              senderId: 'ME',
              createdAt: new Date().toISOString() 
          },
          aiMessage: {
            id: (Date.now() + 1).toString(),
            senderId: 'AI_ASSISTANT',
            content: aiResponse.text, 
            options: aiResponse.options,
            searchSuggestions: aiResponse.searchSuggestions,
            // Sửa 'TEXT' thành MessageType.TEXT, 'PRODUCT' thành MessageType.PRODUCT (nếu bạn đã thêm vào Enum Prisma)
            // Nếu Prisma chưa có PRODUCT, bạn phải dùng string as any hoặc thêm vào schema.prisma
            type: aiResponse.products?.length ? 'PRODUCT' : MessageType.TEXT, 
            payload: aiResponse.products, 
            createdAt: new Date().toISOString() 
          }
        };
      }
      throw new Error("Guest login required");
    }

    // 2. Xử lý logic USER ĐĂNG NHẬP (Lưu DB như cũ)
    // Lưu tin nhắn user gửi
    const savedUserMsg = await this.sendMessageToDb(userId, dto);

    if (dto.receiverId === 'AI_ASSISTANT') {
        const history = await this.getAiHistory(userId, 6);
        const aiResult = await this.aiService.getAiResponse(userId || 'guest', dto.content, history);
    
        // Sửa kiểu dữ liệu ở đây
        let msgType: MessageType = MessageType.TEXT; // Sử dụng Enum chuẩn
        let msgContent = aiResult.text;

        if (aiResult.products && aiResult.products.length > 0) {
             // LƯU Ý: Nếu schema.prisma của bạn chưa có enum PRODUCT, dòng dưới sẽ lỗi.
             // Hãy đảm bảo schema.prisma: enum MessageType { TEXT, IMAGE, PRODUCT, ... }
             // Nếu chưa có, tạm thời dùng: msgType = 'PRODUCT' as any;
             msgType = 'PRODUCT' as any; 
             msgContent = JSON.stringify(aiResult.products[0]); 
        }

    // Nếu là User thật -> Lưu DB
    let savedAiMsg;
    if (userId) {
         savedAiMsg = await this.sendMessageToDb('AI_ASSISTANT', {
            receiverId: userId,
            content: msgContent, // Lưu JSON string
            type: msgType,
        });
    } else {
        // Mock cho Guest
        savedAiMsg = {
            id: Date.now().toString(),
            senderId: 'AI_ASSISTANT',
            content: msgContent,
            type: msgType,
            createdAt: new Date().toISOString()
        };
    }

        // Trả về cả 2 để frontend hiển thị
        return {
            userMessage: savedUserMsg,
            aiMessage: {
                ...savedAiMsg,
                options: aiResult.options,
                searchSuggestions: aiResult.searchSuggestions
            }
        };
    }

    // Nếu chat người thường
    return { userMessage: savedUserMsg, aiMessage: null };
  }

  private async sendMessageToDb(senderId: string, dto: CreateMessageDto) {
     let conversationId = '';

     const existingConv = await this.prisma.conversation.findFirst({
        where: { AND: [{ participants: { some: { id: senderId } } }, { participants: { some: { id: dto.receiverId } } }] }
     });
     
     if (existingConv) {
         conversationId = existingConv.id;
         await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
     } else {
         const newConv = await this.prisma.conversation.create({
             data: { participants: { connect: [{ id: senderId }, { id: dto.receiverId }] } }
         });
         conversationId = newConv.id;
     }

     const message = await this.prisma.message.create({
        data: {
            senderId, conversationId,
            content: EncryptionUtil.encrypt(dto.content),
            // FIX LỖI TYPE Ở ĐÂY:
            type: dto.type || MessageType.TEXT 
        },
        include: { sender: { select: { id: true, name: true, role: true } } }
     });

     return { ...message, content: EncryptionUtil.decrypt(message.content) };
  }
  async sendMessage(senderId: string, dto: CreateMessageDto) {
    let conversationId = '';

    const existingConv = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: senderId } } },
          { participants: { some: { id: dto.receiverId } } },
        ],
      },
    });

    if (existingConv) {
      conversationId = existingConv.id;
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
    } else {
      const newConv = await this.prisma.conversation.create({
        data: {
          participants: {
            connect: [{ id: senderId }, { id: dto.receiverId }],
          },
        },
      });
      conversationId = newConv.id;
    }

    const message = await this.prisma.message.create({
      data: {
        senderId,
        conversationId,
        content: EncryptionUtil.encrypt(dto.content),
        type: dto.type, // Không còn lỗi vì đã thêm type vào DTO
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    return { 
      ...message, 
      content: EncryptionUtil.decrypt(message.content),
      // Trả về senderId rõ ràng để Gateway dùng nếu cần
      senderId: message.senderId 
    };
  }

  // --- API LOGIC ---

  async searchUsers(query: string, currentUserId: string) {
  return this.prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        {
          OR: [
            // <--- Xóa dòng mode: 'insensitive' để tránh lỗi type
            { email: { contains: query } }, 
            { name: { contains: query } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    take: 5,
  });
}

  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { id: userId } },
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participants: {
          select: { id: true, name: true, role: true, email: true }, // Avatar nếu có
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Format lại để FE dễ hiển thị (Lọc lấy thông tin người "kia")
    return conversations.map((conv) => {
      const partner = conv.participants.find((p) => p.id !== userId);
      const lastMsg = conv.messages[0];
      return {
        id: conv.id,
        partner,
        lastMessage: lastMsg?.content || '',
        lastMessageAt: conv.lastMessageAt,
        isRead: lastMsg?.senderId === userId ? true : lastMsg?.isRead,
      };
    });
  }

  async getMessages(conversationId: string, limit: number = 20, cursor?: string) {
    // 1. Lấy dữ liệu từ DB (Cần await để lấy kết quả thô trước)
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' }, 
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // 2. Map qua từng tin nhắn để giải mã nội dung
    return messages.map((msg) => {
      try {
        return {
          ...msg,
          // Giải mã nội dung trước khi trả về FE
          content: EncryptionUtil.decrypt(msg.content),
        };
      } catch (error) {
        // Phòng trường hợp dữ liệu cũ chưa mã hoá hoặc lỗi key, trả về nguyên gốc để không crash app
        return msg;
      }
    });
  }

  async markAsRead(conversationId: string, userId: string) {
    // Đánh dấu tất cả tin nhắn trong hội thoại mà KHÔNG PHẢI do mình gửi là đã đọc
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
    return { success: true };
  }

  async findOrCreateConversation(userId: string, partnerId: string) {
    // 1. Tìm hội thoại cũ
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: userId } } },
          { participants: { some: { id: partnerId } } },
        ],
      },
      include: {
        participants: { select: { id: true, name: true, role: true, email: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    // 2. Nếu chưa có -> Tạo mới
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          participants: { connect: [{ id: userId }, { id: partnerId }] },
        },
        include: {
          participants: { select: { id: true, name: true, role: true, email: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      });
    }

    // 3. Format dữ liệu
    const partner = conversation.participants.find((p) => p.id !== userId);
    const lastMsg = conversation.messages[0];

    return {
      id: conversation.id,
      partner,
      lastMessage: lastMsg?.content || '',
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: lastMsg && lastMsg.senderId !== userId && !lastMsg.isRead ? 1 : 0,
    };
  }
}