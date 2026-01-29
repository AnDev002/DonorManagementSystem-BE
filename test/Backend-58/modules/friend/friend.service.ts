import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway'; // Tận dụng Gateway của Chat để bắn noti
import { FriendshipStatus } from '@prisma/client';

@Injectable()
export class FriendService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway // Inject Gateway để real-time
  ) {}

  // 1. Gửi lời mời kết bạn
  async sendFriendRequest(userId: string, receiverId: string) {
    if (userId === receiverId) throw new BadRequestException("Không thể kết bạn với chính mình");

    // Kiểm tra xem đã tồn tại quan hệ chưa (kể cả chiều ngược lại)
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: receiverId },
          { senderId: receiverId, receiverId: userId },
        ]
      }
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) throw new BadRequestException("Hai bạn đã là bạn bè");
      if (existing.status === FriendshipStatus.PENDING) throw new BadRequestException("Đã có lời mời kết bạn đang chờ");
    }

    // Tạo request mới
    const friendship = await this.prisma.friendship.create({
      data: {
        senderId: userId,
        receiverId: receiverId,
        status: FriendshipStatus.PENDING
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } }
    });

    // 🔥 Real-time: Bắn socket báo cho người nhận (receiverId)
    // Client cần listen sự kiện 'new_friend_request'
    this.chatGateway.server.to(`user_${receiverId}`).emit('new_friend_request', friendship);

    return { message: "Đã gửi lời mời kết bạn", data: friendship };
  }

  // 2. Chấp nhận / Từ chối
  async handleFriendRequest(userId: string, requestId: string, action: 'ACCEPT' | 'REJECT') {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: requestId }
    });

    if (!friendship) throw new NotFoundException("Lời mời không tồn tại");
    if (friendship.receiverId !== userId) throw new BadRequestException("Bạn không có quyền xử lý lời mời này");
    if (friendship.status !== FriendshipStatus.PENDING) throw new BadRequestException("Lời mời này đã được xử lý trước đó");

    if (action === 'REJECT') {
      await this.prisma.friendship.delete({ where: { id: requestId } });
      return { message: "Đã từ chối lời mời" };
    }

    // ACCEPT
    const updated = await this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: FriendshipStatus.ACCEPTED },
      include: { receiver: { select: { id: true, name: true, avatar: true } } }
    });

    // 🔥 Real-time: Báo cho người gửi là "A đã chấp nhận lời mời"
    this.chatGateway.server.to(`user_${friendship.senderId}`).emit('friend_request_accepted', updated);

    return { message: "Đã trở thành bạn bè", data: updated };
  }

  // 3. Lấy danh sách bạn bè (Cho trang /user/friends)
  async getFriendList(userId: string) {
    const friends = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, email: true } },
        receiver: { select: { id: true, name: true, avatar: true, email: true } }
      }
    });

    // Map lại dữ liệu để FE dễ hiển thị
    return friends.map(f => {
      const isSender = f.senderId === userId;
      const friendInfo = isSender ? f.receiver : f.sender;
      return {
        friendshipId: f.id,
        ...friendInfo,
        joinedAt: f.createdAt
      };
    });
  }

  // 4. Lấy danh sách lời mời đã nhận (Pending)
  async getPendingRequests(userId: string) {
    console.log(">>> [DEBUG] Finding pending requests for Receiver ID:", userId);

    const requests = await this.prisma.friendship.findMany({
      where: {
        receiverId: userId,          // Đảm bảo userId này chính xác
        status: FriendshipStatus.PENDING
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(">>> [DEBUG] Found:", requests.length, "requests");
    return requests;
  }

  // 5. Hủy kết bạn
  async unfriend(userId: string, friendId: string) {
    // Tìm record bất kể ai là sender/receiver
    const friendship = await this.prisma.friendship.findFirst({
        where: {
            status: FriendshipStatus.ACCEPTED,
            OR: [
                { senderId: userId, receiverId: friendId },
                { senderId: friendId, receiverId: userId }
            ]
        }
    });

    if (!friendship) throw new NotFoundException("Các bạn chưa kết bạn");

    await this.prisma.friendship.delete({ where: { id: friendship.id } });
    return { success: true, message: "Đã hủy kết bạn" };
  }

  async searchUsers(userId: string, keyword: string) {
    if (!keyword || keyword.trim() === '') return [];

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          { role: { in: ['BUYER', 'SELLER'] } }, 
          {
            OR: [
              { name: { contains: keyword } }, 
              { email: { contains: keyword } }
            ]
          }
        ]
      },
      select: { id: true, name: true, avatar: true, email: true, role: true }, // Nên select thêm role để FE hiển thị
      take: 20
    });

    // 2. Kiểm tra trạng thái bạn bè với từng người tìm được
    const results = await Promise.all(users.map(async (u) => {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: u.id },
            { senderId: u.id, receiverId: userId }
          ]
        }
      });

      let status: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND' = 'NONE';

      if (friendship) {
        if (friendship.status === FriendshipStatus.ACCEPTED) {
          status = 'FRIEND';
        } else if (friendship.status === FriendshipStatus.PENDING) {
          // Nếu mình là người gửi -> PENDING_SENT
          // Nếu mình là người nhận -> PENDING_RECEIVED
          status = friendship.senderId === userId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
        }
      }

      return { ...u, status };
    }));

    return results;
  }
}