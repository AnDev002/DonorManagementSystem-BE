import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MessageType } from '@prisma/client'; // <--- Thêm import này

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  receiverId: string; 

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsEnum(MessageType) // <--- Validate dữ liệu đầu vào phải nằm trong Enum
  type?: MessageType = MessageType.TEXT; // <--- Gán giá trị mặc định theo Enum
}

export class OpenChatDto {
  @IsString()
  @IsNotEmpty()
  receiverId: string;
}