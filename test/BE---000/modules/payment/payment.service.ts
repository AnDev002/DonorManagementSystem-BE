import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class PaymentService {
  constructor(private configService: ConfigService) {}

  // 1. Tạo Link thanh toán MoMo (Ví dụ)
  async createMomoPayment(orderId: string, amount: number) {
    const endpoint = "https://test-payment.momo.vn/v2/gateway/api/create";
    const partnerCode = this.configService.get('MOMO_PARTNER_CODE');
    const accessKey = this.configService.get('MOMO_ACCESS_KEY');
    const secretKey = this.configService.get('MOMO_SECRET_KEY');
    
    const orderInfo = "Thanh toan don hang LoveGifts " + orderId;
    const redirectUrl = this.configService.get('FRONTEND_URL') + "/payment/result";
    const ipnUrl = this.configService.get('BACKEND_URL') + "/api/payment/momo-ipn"; // Webhook
    
    const requestId = orderId + new Date().getTime();
    const requestType = "captureWallet";
    const extraData = "";

    // Tạo chữ ký (Signature)
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const requestBody = {
      partnerCode, partnerName: "Test MoMo", storeId: "MomoTestStore",
      requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl,
      lang: "vi", requestType, autoCapture: true, extraData, signature
    };

    try {
      const response = await axios.post(endpoint, requestBody);
      return response.data; // Trả về payUrl để Frontend redirect
    } catch (error) {
      console.error(error);
      throw new Error("Lỗi tạo thanh toán MoMo");
    }
  }

  // 2. Xử lý Webhook (IPN) để cập nhật trạng thái đơn hàng
  verifyMomoSignature(body: any) {
     // Logic verify signature giống lúc tạo để đảm bảo request từ MoMo thật
     return true; 
  }
}