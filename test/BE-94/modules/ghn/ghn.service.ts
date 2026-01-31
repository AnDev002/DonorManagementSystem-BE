import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GhnService {
  private readonly logger = new Logger(GhnService.name);
  private apiUrl: string;
  private token: string;
  private shopId: number;
  private defaultFromDistrictId = 1454; // Quận Thanh Xuân, Hà Nội (Đảm bảo ID này đúng với cấu hình shop của bạn)

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('GHN_API_URL') || 'https://dev-online-gateway.ghn.vn/shiip/public-api';
    this.token = this.configService.get<string>('GHN_TOKEN')!;
    this.shopId = Number(this.configService.get<string>('GHN_SHOP_ID')) || 0;
  }

  private getHeaders() {
    return {
      token: this.token,
      shop_id: this.shopId,
      'Content-Type': 'application/json',
    };
  }

  // [FIX] Lấy service_id an toàn nhất
  async getServiceId(toDistrictId: number, fromDistrictId: number, weight: number) {
    try {
        const url = `${this.apiUrl}/v2/shipping-order/available-services`;
        const payload = {
            shop_id: this.shopId,
            from_district: fromDistrictId, 
            to_district: toDistrictId,
            weight: weight || 200 // Truyền weight để GHN lọc gói phù hợp
        };

        const { data } = await firstValueFrom(
            this.httpService.post(url, payload, { headers: { token: this.token } }) 
        );

        if (!data.data || data.data.length === 0) {
            return null;
        }

        // [QUAN TRỌNG] Tìm gói E-Commerce (service_type_id = 2)
        // Gói thường (Standard) hoặc Thương mại điện tử
        const ecommerceService = data.data.find((s: any) => s.service_type_id === 2);
        
        // Nếu có gói chuẩn thì dùng, không thì mới fallback về cái đầu tiên
        return ecommerceService ? ecommerceService.service_id : data.data[0].service_id; 

    } catch (error: any) {
        this.logger.error(`Get Service Error: ${JSON.stringify(error.response?.data || error.message)}`);
        return null; 
    }
  }

  // [FIX 2] Truyền weight vào getServiceId
  async calculateFee(params: {
    toDistrictId: number;
    toWardCode: string;
    weight: number;
    insuranceValue: number;
  }) {
    try {
      // Gọi getServiceId với cân nặng thực tế
      const serviceId = await this.getServiceId(
          params.toDistrictId, 
          this.defaultFromDistrictId, 
          params.weight
      );
      
      if (!serviceId) {
          this.logger.warn(`Không tìm thấy gói vận chuyển cho tuyến ${this.defaultFromDistrictId} -> ${params.toDistrictId}`);
          return 30000; 
      }

      // Gọi API tính phí
      const url = `${this.apiUrl}/v2/shipping-order/fee`;
      const payload = {
        service_id: serviceId,
        insurance_value: params.insuranceValue,
        coupon: null,
        from_district_id: this.defaultFromDistrictId,
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        height: 10, length: 10, width: 10, 
        weight: params.weight,
      };

      const { data } = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );

      return data.data.total; 
    } catch (error: any) {
      // Log lỗi chi tiết để debug nếu cần
      // console.log('GHN Fee Error Detail:', JSON.stringify(error.response?.data));
      this.logger.error(`GHN Fee Error: ${JSON.stringify(error.response?.data || error.message)}`);
      return 30000; 
    }
  }

  // 2. Tính thời gian giao hàng (Lead Time)
  async calculateExpectedDeliveryTime(params: { toDistrictId: number; toWardCode: string }) {
    try {
      // Mặc định truyền 200g để lấy thời gian ước tính
      const serviceId = await this.getServiceId(params.toDistrictId, this.defaultFromDistrictId, 200);
      if (!serviceId) return null;

      const url = `${this.apiUrl}/v2/shipping-order/leadtime`;
      const payload = {
        from_district_id: this.defaultFromDistrictId,
        from_ward_code: "20314", 
        to_district_id: params.toDistrictId,
        to_ward_code: params.toWardCode,
        service_id: serviceId, 
      };

      const { data } = await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );

      return data.data.leadtime; 
    } catch (error: any) {
      return Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60; 
    }
  }

  // [FIX 3] Truyền weight vào khi tạo đơn thật
  async createShippingOrder(orderData: any) {
    // --- ĐOẠN CODE GỌI API THẬT (ĐÃ COMMENT LẠI) ---
    /*
    try {
        const totalWeight = orderData.weight || 200;
        const serviceId = await this.getServiceId(
            orderData.to_district_id, 
            this.defaultFromDistrictId,
            totalWeight
        );
        
        const url = `${this.apiUrl}/v2/shipping-order/create`;
        const payload = {
            ...orderData,
            payment_type_id: 2, 
            required_note: 'CHOXEMHANGKHONGTHU',
            service_id: serviceId || 53320, 
            from_district_id: this.defaultFromDistrictId,
        };

        const { data } = await firstValueFrom(
            this.httpService.post(url, payload, { headers: this.getHeaders() })
        );
        return data.data; 
    } catch (error: any) {
        this.logger.error('GHN Create Order Error:', error.response?.data || error.message);
        throw new BadRequestException('Không thể tạo đơn vận chuyển GHN');
    }
    */

    // --- ĐOẠN CODE GIẢ LẬP (MOCK) ---
    this.logger.log(`[MOCK GHN] Giả lập tạo đơn hàng thành công cho: ${orderData.to_name}`);
    
    // Trả về dữ liệu giả giống hệt cấu trúc GHN trả về thật
    // Để OrderService không bị lỗi khi đọc 'order_code' hay 'total_fee'
    return {
        order_code: 'MOCK_GHN_' + Date.now(), // Mã đơn giả: MOCK_GHN_17000000...
        total_fee: 35000, // Phí ship giả định
        expected_delivery_time: new Date().toISOString(),
        status: 'ready_to_pick',
        // Thêm các trường khác nếu cần
    };
  }

  async getProvinces() {
    try {
      const url = `${this.apiUrl}/master-data/province`;
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { token: this.token } })
      );
      return data.data; // Trả về mảng [{ ProvinceID, ProvinceName, ... }]
    } catch (error) {
      console.error('Lỗi lấy Tỉnh/Thành GHN:', error?.response?.data || error.message);
      return [];
    }
  }

  // 5. Lấy danh sách Quận/Huyện theo Tỉnh
  async getDistricts(provinceId: number) {
    try {
      const url = `${this.apiUrl}/master-data/district`;
      const { data } = await firstValueFrom(
        this.httpService.post(url, { province_id: provinceId }, { headers: { token: this.token } })
      );
      return data.data; // Trả về mảng [{ DistrictID, DistrictName, ... }]
    } catch (error) {
      console.error(`Lỗi lấy Quận/Huyện (Province: ${provinceId}):`, error?.response?.data || error.message);
      return [];
    }
  }

  // 6. Lấy danh sách Phường/Xã theo Quận
  async getWards(districtId: number) {
    try {
      const url = `${this.apiUrl}/master-data/ward?district_id=${districtId}`;
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { token: this.token } })
      );
      return data.data; // Trả về mảng [{ WardCode, WardName, ... }]
    } catch (error) {
      console.error(`Lỗi lấy Phường/Xã (District: ${districtId}):`, error?.response?.data || error.message);
      return [];
    }
  }
}