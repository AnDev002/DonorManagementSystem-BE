import { IsString, IsOptional, IsObject, IsEnum, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum EventType {
  VIEW_PAGE = 'view_page',
  VIEW_PRODUCT = 'view_product',
  CLICK_PRODUCT = 'click_product',
  ADD_TO_CART = 'add_to_cart',
  SEARCH = 'search',
  FILTER_PRODUCTS = 'filter_products',
  BEGIN_CHECKOUT = 'begin_checkout',
  PURCHASE = 'purchase',
  IDENTIFY = 'identify',
  ADD_SHIPPING_INFO = 'add_shipping_info',
  CLICK_PLACE_ORDER = 'click_place_order',
  VIEW_ORDER_SUCCESS = 'view_order_success',
  APPROVE_SELLER = 'approve_seller',
  REJECT_SELLER = 'reject_seller',
  BAN_SHOP = 'ban_shop',
  UNBAN_SHOP = 'unban_shop',
  CREATE_USER = 'create_user',
  BAN_USER = 'ban_user',
  UNBAN_USER = 'unban_user',
  DELETE_USER = 'DELETE_USER',
}

export class TrackEventDto {
  // [MỚI] Cho phép nhận ID từ Client để khử trùng lặp
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsEnum(EventType)
  type: EventType;

  @IsString()
  @IsOptional() 
  targetId?: string; 

  @IsOptional()
  @IsObject()
  metadata?: any; 
}

export class TrackBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[];
}