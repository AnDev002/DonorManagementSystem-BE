import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../../database/prisma/prisma.service';

@Processor('promotion_sync')
export class PromotionProcessor {
  constructor(private readonly prisma: PrismaService) {}

  @Process('save_user_voucher')
  async handleSaveUserVoucher(job: Job<{ userId: string; code: string }>) {
    const { userId, code } = job.data;

    // Tìm voucherId từ code
    const voucher = await this.prisma.voucher.findUnique({ where: { code } });
    if (!voucher) return;

    // Insert vào DB (Sử dụng createMany hoặc create với ignore conflicts nếu cần)
    try {
        await this.prisma.userVoucher.create({
            data: {
                userId,
                voucherId: voucher.id,
                isUsed: false
            }
        });
        
        // Update lại usageCount trong bảng Voucher (để thống kê)
        // Lưu ý: Không cần chính xác tuyệt đối real-time, chỉ cần eventual consistency
        await this.prisma.voucher.update({
            where: { id: voucher.id },
            data: { usageCount: { increment: 1 } }
        });
    } catch (e) {
        // Handle lỗi duplicate nếu queue chạy lại (idempotency)
        console.error('Lỗi sync voucher:', e.message);
    }
  }
}