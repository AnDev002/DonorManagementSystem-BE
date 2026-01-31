import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Nếu không truyền data (@User()), trả về full user
    if (!data) return user;

    // [LOGIC MỚI]
    // Nếu truyền data (@User('id')) nhưng user không có property đó, hoặc code cũ đang mong đợi object
    // Ta kiểm tra xem user[data] có tồn tại không.
    
    // Trường hợp fix cho AddressService: lấy id (string)
    if (data === 'id' && user?.id) return user.id;

    // Các trường hợp khác trả về property tương ứng
    return user ? user[data] : null;
  },
);