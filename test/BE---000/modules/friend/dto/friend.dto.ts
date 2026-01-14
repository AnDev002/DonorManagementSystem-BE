import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export class FriendRequestDto {
  @IsString()
  @IsNotEmpty()
  receiverId: string; // ID người muốn kết bạn
}

export class HandleRequestDto {
  @IsString()
  @IsNotEmpty()
  requestId: string; // ID của bản ghi Friendship

  @IsEnum(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';
}