// src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Global() // 1. Đánh dấu @Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 2. Export service ra ngoài
})
export class DatabaseModule {}