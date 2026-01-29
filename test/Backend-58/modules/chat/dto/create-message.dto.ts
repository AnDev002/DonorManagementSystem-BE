// src/chat/dto/create-message.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { MessageType } from '@prisma/client'; 

// --- QUAN TRỌNG: Re-export để sửa lỗi "declares locally but is not exported" ---
export { MessageType }; 

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @IsOptional()
  @IsEnum(MessageType) 
  type?: MessageType = MessageType.TEXT; 
}