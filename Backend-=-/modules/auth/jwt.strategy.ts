import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma/prisma.service';

const extractJwtFromCookie = (req: Request) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secret_key',
    });
  }

  async validate(payload: any) {
    // [DEBUG] In ra để kiểm tra xem Token có đúng userId không
    console.log(`[JwtStrategy] Validating userId: ${payload.userId}`);

    if (!payload.userId) {
        console.error('[JwtStrategy] Token invalid: missing userId');
        throw new UnauthorizedException('Token không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      console.error(`[JwtStrategy] User not found in DB (ID: ${payload.userId})`);
      // User trong token không khớp với DB (do reset DB hoặc user bị xóa)
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị xóa.');
    }

    // Trả về user để gắn vào req.user
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        shopName: user.shopName // Thêm field này nếu cần dùng ở Controller
    };
  }
}