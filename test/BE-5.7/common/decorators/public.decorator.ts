import { SetMetadata } from '@nestjs/common';

// Key này dùng để đánh dấu route là Public (không cần Token)
export const IS_PUBLIC_KEY = 'isPublic';

// Decorator @Public()
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);