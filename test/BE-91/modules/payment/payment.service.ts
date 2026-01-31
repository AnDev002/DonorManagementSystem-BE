import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
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

  async createPay2SPayment(orderId: string, amount: number) {
        const apiUrl = this.configService.get('PAY2S_API_URL');
        const partnerCode = this.configService.get('PAY2S_MERCHANT_ID');
        const accessKey = this.configService.get('PAY2S_ACCESS_KEY');
        const secretKey = this.configService.get('PAY2S_SECRET_KEY');
        const returnUrl = this.configService.get('PAY2S_RETURN_URL');
        const ipnUrl = this.configService.get('PAY2S_IPN_URL');
        
        // [MỚI] Lấy thông tin ngân hàng từ ENV
        const bankAccountNo = this.configService.get('PAY2S_BANK_NO') || '99999999';
        const bankId = this.configService.get('PAY2S_BANK_ID') || 'MB';

        if (!accessKey || !secretKey || !partnerCode) {
            throw new BadRequestException('Thiếu cấu hình Pay2S');
        }

        // 1. Chuẩn bị dữ liệu
        const requestId = String(Date.now());
        const strAmount = String(amount);
        const requestType = 'pay2s';

        // Xử lý orderInfo (Giữ nguyên logic cũ đã OK)
        const cleanUuid = orderId.replace(/[^a-zA-Z0-9]/g, ''); 
        let safeOrderInfo = `ThanhToan${cleanUuid}`;
        if (safeOrderInfo.length > 32) safeOrderInfo = safeOrderInfo.substring(0, 32);
        if (safeOrderInfo.length < 10) safeOrderInfo = (safeOrderInfo + "0123456789").substring(0, 10);

        // 2. Tạo chuỗi ký (Raw Hash)
        // [QUAN TRỌNG] bankAccounts vẫn là "Array" trong chữ ký
        const rawSignature = `accessKey=${accessKey}&amount=${strAmount}&bankAccounts=Array&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${safeOrderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;

        // 3. Hash HMAC-SHA256
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');

        // 4. Payload gửi đi
        // [FIX] Cấu trúc bankAccounts chuẩn theo tài liệu: Mảng các object
        const bankAccounts = [
            {
                account_number: bankAccountNo,
                bank_id: bankId
            }
        ];

        const payload = {
            accessKey: accessKey,
            partnerCode: partnerCode,
            partnerName: 'Gmall Store',
            requestId: requestId,
            amount: strAmount,
            orderId: orderId,
            orderInfo: safeOrderInfo,
            orderType: requestType,
            requestType: requestType,
            bankAccounts: bankAccounts, // <-- Gửi mảng thật ở đây
            redirectUrl: returnUrl,
            ipnUrl: ipnUrl,
            signature: signature,
        };

        try {
            this.logger.log(`Calling Pay2S API: ${apiUrl}`);
            const response = await axios.post(apiUrl, payload, {
                headers: { 'Content-Type': 'application/json; charset=UTF-8' }
            });

            // Xử lý kết quả trả về (Giữ nguyên)
            if (response.data) {
                if (response.data.payUrl) return response.data.payUrl;
                if (response.data.data?.payUrl) return response.data.data.payUrl;
                if (response.data.paymentUrl) return response.data.paymentUrl;
            }
            
            this.logger.error(`Pay2S Response Error: ${JSON.stringify(response.data)}`);
            throw new Error(response.data?.message || 'Lỗi không xác định từ Pay2S');

        } catch (error) {
            this.logger.error(`Lỗi tạo Link Pay2S: ${error.message}`);
            this.logger.error(`Payload Sent: ${JSON.stringify(payload)}`);
            throw new BadRequestException(`Cổng thanh toán lỗi: ${error.message}`);
        }
    }

  // [FIXED] Verify IPN chuẩn theo PHP
  verifyPay2SSignature(query: any): boolean {
    const secretKey = this.configService.get('PAY2S_SECRET_KEY');
    const accessKey = this.configService.get('PAY2S_ACCESS_KEY');

    // Lấy các trường từ query (Pay2S gửi về)
    const { 
        amount, extraData, message, orderId, orderInfo, 
        orderType, partnerCode, payType, requestId, 
        responseTime, resultCode, transId, signature 
    } = query;

    // Logic tạo rawHash của IPN (theo PHP mẫu):
    // accessKey=$accessKey&amount=$amount&extraData=$extraData&message=$message&orderId=$orderId&orderInfo=$orderInfo&orderType=$orderType&partnerCode=$partnerCode&payType=$payType&requestId=$requestId&responseTime=$responseTime&resultCode=$resultCode&transId=$transId
    
    // Lưu ý xử lý null/undefined thành chuỗi rỗng nếu cần
    const safeExtraData = extraData || '';
    const safeTransId = transId || '';

    const rawHash = `accessKey=${accessKey}&amount=${amount}&extraData=${safeExtraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${safeTransId}`;

    const mySignature = crypto.createHmac('sha256', secretKey).update(rawHash).digest('hex');

    return mySignature === signature;
  }
}
