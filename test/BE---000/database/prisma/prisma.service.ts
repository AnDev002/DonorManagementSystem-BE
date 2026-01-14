// Backend-Lovegifts/database/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['error', 'warn'], // Chỉ log lỗi để giảm I/O
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Cấu hình Connection Pool cho Prisma (cần thêm vào query string của URL trong .env hoặc config tại đây nếu driver hỗ trợ)
      // Lưu ý: Prisma quản lý pool tự động, nhưng ta có thể tối ưu bằng cách tính toán:
      // num_physical_cpus * 2 + 1. Ví dụ server 4 core -> connection_limit=9 hoặc 10.
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Đã kết nối thành công tới database MySQL với Connection Pool.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}