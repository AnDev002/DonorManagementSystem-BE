import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
// Hàm này nhận vào danh sách các Role (ví dụ: Role.ADMIN, Role.SELLER)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);