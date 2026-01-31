import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../database/prisma/prisma.service';
// SỬA DÒNG NÀY: Thêm từ khóa 'type'
import type { Response } from 'express'; 

@Controller('payment')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private prisma: PrismaService
  ) {}

  @Get('pay2s-ipn') 
  async handlePay2SIPN(@Query() query: any, @Res() res: Response) {
    // 1. Verify chữ ký
    const isValid = this.paymentService.verifyPay2SSignature(query);
    if (!isValid) {
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Invalid Signature' });
    }

    // 2. Cập nhật trạng thái đơn hàng
    const { order_id } = query;
    const order = await this.prisma.order.findUnique({ where: { id: order_id } });

    if (order && order.paymentStatus === 'PENDING') {
       await this.prisma.order.update({
         where: { id: order_id },
         data: { paymentStatus: 'PAID' } 
       });
    }

    return res.status(HttpStatus.OK).send({ success: true });
  }
}