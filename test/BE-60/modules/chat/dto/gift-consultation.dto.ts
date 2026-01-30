import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum ConsultationStep {
  INIT = 'INIT',
  ASK_RECIPIENT = 'ASK_RECIPIENT',
  ASK_OCCASION = 'ASK_OCCASION',
  ASK_RELATIONSHIP = 'ASK_RELATIONSHIP',
  ASK_INTERESTS = 'ASK_INTERESTS',
  ASK_BUDGET = 'ASK_BUDGET',
  RECOMMENDING = 'RECOMMENDING',
  COMPLETED = 'COMPLETED'
}

export interface ConsultationState {
  step: ConsultationStep;
  data: {
    recipient?: string;
    occasion?: string;
    relationship?: string;
    interests?: string[]; // <--- [FIX] Sửa từ string thành string[]
    budget?: string;
    suggestedIds?: number[]; 
  };
  history: string[];
}

export class UserReplyDto {
  message: string;
  sessionId: string;
}

export class GiftConsultationDto {
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsString()
  @IsNotEmpty()
  occasion: string;

  @IsArray()
  @IsOptional()
  interests: string[];

  @IsString()
  @IsNotEmpty()
  budgetRange: string;
}