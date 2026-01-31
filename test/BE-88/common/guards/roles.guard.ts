import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy danh sách Role yêu cầu từ @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Nếu API không yêu cầu Role nào (không gắn @Roles), cho qua luôn
    if (!requiredRoles) {
      return true;
    }

    // 3. Lấy user từ request (User này do JwtAuthGuard gán vào sau khi decode token)
    const { user } = context.switchToHttp().getRequest();

    // 4. Kiểm tra: User có tồn tại không? Role của user có nằm trong danh sách cho phép không?
    // Lưu ý: user.role phải khớp với Role trong Enum Prisma
    return user && requiredRoles.some((role) => user.role === role);
  }
}