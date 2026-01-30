import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { PointType, Prisma } from '@prisma/client';
import { MailerService } from '@nestjs-modules/mailer'; // [FIX 3] Import MailerService
import moment from 'moment';

@Injectable()
export class PointService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService, // Tên biến là 'redis'
    private mailerService: MailerService, // [FIX 3] Inject MailerService
  ) {}

  // 1. Lấy thông tin ví & checkin
  async getMyPointInfo(userId: string) {
    const wallet = await this.prisma.pointWallet.findUnique({ where: { userId } });
    const checkIn = await this.prisma.dailyCheckIn.findUnique({ where: { userId } });

    const isCheckedInToday = checkIn 
      ? moment(checkIn.lastCheckInDate).isSame(moment(), 'day') 
      : false;

    const dayOfWeek = moment().isoWeekday();

    return {
      points: wallet?.balance || 0,
      streak: checkIn?.currentStreak || 0,
      isCheckedInToday,
      dayOfWeek,
    };
  }

  // 2. Hàm cộng/trừ điểm an toàn
  async addPoints(
    userId: string, 
    amount: number, 
    type: PointType, 
    referenceId: string, 
    description: string, 
    tx: Prisma.TransactionClient
  ) {
    const wallet = await tx.pointWallet.upsert({
      where: { userId },
      create: { userId, balance: amount > 0 ? amount : 0 },
      update: { balance: { increment: amount } },
    });

    if (wallet.balance < 0) {
      throw new BadRequestException('Số dư không đủ.');
    }

    await tx.pointHistory.create({
      data: {
        userId,
        amount,
        type,
        source: 'GAME',
        description,
        // [FIX 5] Bỏ refId vì schema không có
      }
    });

    return wallet.balance;
  }

  // 3. Wrapper Transaction
  async processTransaction(
    userId: string, 
    amount: number, 
    type: PointType, 
    referenceId: string, 
    description: string
  ) {
    return this.prisma.$transaction(async (tx) => {
       const newBalance = await this.addPoints(userId, amount, type, referenceId, description, tx);
       return { newBalance };
    });
  }

  // 4. Điểm danh hàng ngày
  async dailyCheckIn(userId: string) {
    const lockKey = `lock:checkin:${userId}`;
    const isLocked = await this.redis.setNX(lockKey, '1', 5);
    if (!isLocked) throw new BadRequestException('Thao tác quá nhanh.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        let record = await tx.dailyCheckIn.findUnique({ where: { userId } });
        const now = moment();
        
        if (!record) {
          record = await tx.dailyCheckIn.create({
            data: { userId, lastCheckInDate: now.subtract(1, 'day').toDate(), currentStreak: 0 }
          });
        }

        const lastCheckIn = moment(record.lastCheckInDate);
        if (now.isSame(lastCheckIn, 'day')) {
           throw new BadRequestException('Hôm nay đã điểm danh rồi.');
        }

        const isConsecutive = now.clone().subtract(1, 'day').isSame(lastCheckIn, 'day');
        const isMonday = now.isoWeekday() === 1;
        
        let newStreak = (isConsecutive && !isMonday) ? record.currentStreak + 1 : 1;
        
        const rewards: Record<number, number> = { 1: 100, 2: 150, 3: 200, 4: 250, 5: 300, 6: 400, 7: 1000 };
        const earned = rewards[now.isoWeekday()] || 100;

        await tx.dailyCheckIn.update({
          where: { userId },
          data: { lastCheckInDate: now.toDate(), currentStreak: newStreak }
        });

        await this.addPoints(userId, earned, PointType.EARN_DAILY, `DAILY_${now.format('YYYYMMDD')}`, `Điểm danh T${now.isoWeekday()}`, tx);

        return { earned, streak: newStreak };
      });
    } finally {
      await this.redis.del(lockKey);
    }
  }

  // 5. Lấy lịch sử
  async getHistory(userId: string) {
    return this.prisma.pointHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  // 6. Reset Test
  async resetDailyTest(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const checkinKey = `checkin:${userId}:${today}`;
    const gachaKey = `gacha:${userId}:${today}`;
    
    await this.redis.del(checkinKey);
    await this.redis.del(gachaKey);
    
    return { message: 'Đã reset! Bạn có thể điểm danh lại.' };
  }

  // --- 7. CHUYỂN XU (ĐÃ FIX LỖI) ---
  async initiateTransfer(senderId: string, receiverId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Số xu chuyển phải lớn hơn 0');
    if (senderId === receiverId) throw new BadRequestException('Không thể tự chuyển cho chính mình');

    // [FIX 1] point -> pointWallet, amount -> balance
    const senderWallet = await this.prisma.pointWallet.findUnique({ where: { userId: senderId } });
    if (!senderWallet || senderWallet.balance < amount) { 
      throw new BadRequestException('Số dư không đủ để thực hiện giao dịch.');
    }

    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new BadRequestException('Người nhận không tồn tại.');

    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
    if (!sender) throw new BadRequestException('Người gửi không hợp lệ.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const transferData = JSON.stringify({ receiverId, amount, otp });
    
    // [FIX 2] redisService -> redis
    await this.redis.set(`transfer_otp:${senderId}`, transferData, 300);

    if(sender.email && sender.email != null && sender.email != undefined && sender.email != "")
    {
      // [FIX 3] mailerService đã có
      await this.mailerService.sendMail({
        to: sender.email,
        subject: '[Gmall] Mã xác thực chuyển Xu',
        html: `
          <h3>Xác thực chuyển xu</h3>
          <p>Bạn đang thực hiện chuyển <b>${amount} xu</b> cho tài khoản <b>${receiver.email}</b>.</p>
          <p>Mã OTP của bạn là: <b style="font-size: 20px; color: red;">${otp}</b></p>
          <p>Mã có hiệu lực trong 5 phút.</p>
        `,
      });
  
      return { message: 'Mã OTP đã được gửi về email của bạn.' };
    }
  }

  async confirmTransfer(senderId: string, inputOtp: string) {
    const dataStr = await this.redis.get(`transfer_otp:${senderId}`);
    if (!dataStr) {
      throw new BadRequestException('Giao dịch hết hạn hoặc không tồn tại.');
    }

    const { receiverId, amount, otp } = JSON.parse(dataStr);

    if (otp !== inputOtp) {
      throw new BadRequestException('Mã OTP không chính xác.');
    }

    // [TỐI ƯU 1]: Thực hiện Transaction DB
    const result = await this.prisma.$transaction(async (tx) => {
        // 1. Trừ tiền người gửi
        const senderNew = await tx.pointWallet.update({
            where: { userId: senderId },
            data: { balance: { decrement: amount } }
        });

        // 2. Cộng tiền người nhận
        await tx.pointWallet.upsert({
            where: { userId: receiverId },
            update: { balance: { increment: amount } },
            create: { userId: receiverId, balance: amount }
        });

        // 3. Ghi log (Chạy song song bằng Promise.all để tiết kiệm thời gian)
        await Promise.all([
          tx.pointHistory.create({
              data: {
                  userId: senderId,
                  amount: -amount,
                  type: PointType.TRANSFER_SENT, 
                  source: 'TRANSFER',
                  description: `Chuyển ${amount} xu cho user ${receiverId}`
              }
          }),
          tx.pointHistory.create({
              data: {
                  userId: receiverId,
                  amount: amount,
                  type: PointType.TRANSFER_RECEIVED,
                  source: 'TRANSFER',
                  description: `Nhận ${amount} xu từ user ${senderId}`
              }
          })
        ]);

        return { success: true, newBalance: senderNew.balance };
    }, {
        // [FIX LỖI]: Tăng thời gian timeout lên 20 giây (Mặc định là 5s)
        timeout: 20000, 
        maxWait: 5000 
    });

    // [TỐI ƯU 2]: Đưa Redis ra ngoài Transaction
    // Lý do: Redis không liên quan đến tính toàn vẹn của SQL Transaction.
    // Nếu DB thành công mà xóa Redis lỗi thì cũng không sao (key sẽ tự hết hạn).
    await this.redis.del(`transfer_otp:${senderId}`);

    return result;
  }
}