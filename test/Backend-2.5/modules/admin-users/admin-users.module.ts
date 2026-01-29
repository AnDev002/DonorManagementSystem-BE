import { Module } from '@nestjs/common';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { DatabaseModule } from '../../database/database.module'; 
import { TrackingModule } from '../tracking/tracking.module';
// [THÊM] Import MailerModule (nếu trong AppModule chưa set isGlobal: true)
// Nếu AppModule đã config isGlobal cho Mailer thì không cần, nhưng thêm vào cho chắc chắn.
import { MailerModule } from '@nestjs-modules/mailer'; 

@Module({
  imports: [
    DatabaseModule, 
    TrackingModule,
    MailerModule 
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}