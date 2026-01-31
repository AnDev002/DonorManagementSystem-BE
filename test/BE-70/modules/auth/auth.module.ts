// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './controllers/auth.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from '../../database/database.module';
import { redisStore } from 'cache-manager-redis-store'; // Cách import mới tùy version, thường dùng require nếu lỗi
@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'secret_mac_dinh_123', 
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION_TIME') || '1d') as any,
        },
      }),
    }),
    CacheModule.register(),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // --- SỬA TẠI ĐÂY: Thêm JwtModule vào exports ---
  exports: [PassportModule, AuthService, JwtModule], 
})
export class AuthModule {}