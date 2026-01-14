// BE-3.7/modules/flash-sale/flash-sale.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateFlashSaleSessionDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleSessionDto } from './dto/update-flash-sale.dto';
import { FlashSaleSession, Prisma } from '@prisma/client';

@Injectable()
export class FlashSaleService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper để tính toán trạng thái thời gian
  private mapSessionStatus(session: FlashSaleSession) {
    const now = new Date();
    let timeStatus = 'UPCOMING';

    if (now >= session.startTime && now <= session.endTime) {
      timeStatus = 'ONGOING';
    } else if (now > session.endTime) {
      timeStatus = 'ENDED';
    }

    return {
      ...session,
      timeStatus, // Virtual field
    };
  }

  async createSession(dto: CreateFlashSaleSessionDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('EndTime must be greater than StartTime');
    }

    // Check trùng lịch (Overlap Check)
    // Logic: Session mới trùng nếu (StartA < EndB) AND (EndA > StartB)
    // Và status phải là ENABLED
    const overlapped = await this.prisma.flashSaleSession.findFirst({
      where: {
        status: 'ENABLED',
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } },
        ],
      },
    });

    if (overlapped) {
      throw new BadRequestException(
        `Time slot overlaps with existing session ID: ${overlapped.id}`,
      );
    }

    const session = await this.prisma.flashSaleSession.create({
      data: {
        startTime: start,
        endTime: end,
        status: dto.status || 'ENABLED',
      },
    });

    return this.mapSessionStatus(session);
  }

  async findAll(date?: string) {
    const whereCondition: Prisma.FlashSaleSessionWhereInput = {};

    if (date) {
      // Lọc các session diễn ra trong ngày được chọn
      const searchDate = new Date(date);
      const nextDay = new Date(searchDate);
      nextDay.setDate(searchDate.getDate() + 1);

      whereCondition.startTime = {
        gte: searchDate,
        lt: nextDay,
      };
    }

    const sessions = await this.prisma.flashSaleSession.findMany({
      where: whereCondition,
      orderBy: { startTime: 'desc' },
      include: {
        _count: {
          select: { products: true }, // Đếm số sản phẩm đã đăng ký
        },
      },
    });

    return sessions.map((s) => this.mapSessionStatus(s));
  }

  async update(id: string, dto: UpdateFlashSaleSessionDto) {
    const session = await this.prisma.flashSaleSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Flash Sale Session not found');

    const start = dto.startTime ? new Date(dto.startTime) : session.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : session.endTime;

    if (end <= start) {
      throw new BadRequestException('EndTime must be greater than StartTime');
    }

    // Nếu có thay đổi thời gian, cần check overlap (loại trừ chính nó)
    if (dto.startTime || dto.endTime) {
      const overlapped = await this.prisma.flashSaleSession.findFirst({
        where: {
          id: { not: id }, // Loại trừ bản ghi hiện tại
          status: 'ENABLED',
          AND: [
            { startTime: { lt: end } },
            { endTime: { gt: start } },
          ],
        },
      });

      if (overlapped) {
        throw new BadRequestException('Time slot overlaps with another session');
      }
    }

    const updated = await this.prisma.flashSaleSession.update({
      where: { id },
      data: {
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        status: dto.status,
      },
    });

    return this.mapSessionStatus(updated);
  }

  async remove(id: string) {
    const session = await this.prisma.flashSaleSession.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!session) throw new NotFoundException('Session not found');

    const now = new Date();

    // Điều kiện 1: Đã diễn ra chưa?
    if (session.startTime <= now) {
       throw new BadRequestException('Cannot delete a session that has already started or ended.');
    }

    // Điều kiện 2: Có sản phẩm đăng ký chưa?
    if (session._count.products > 0) {
      throw new BadRequestException('Cannot delete session containing registered products. Remove products first.');
    }

    return this.prisma.flashSaleSession.delete({
      where: { id },
    });
  }
}