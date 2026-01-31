import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './controllers/category.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule], // Import DatabaseModule để dùng PrismaService
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService], // Export nếu các module khác cần dùng
})
export class CategoryModule {}