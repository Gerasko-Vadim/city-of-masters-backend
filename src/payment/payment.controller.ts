import { Controller, Post, Get, Param, ParseIntPipe, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  initiatePayment(
    @Body()
    body: {
      customerName: string;
      phone: string;
      address: string;
      description?: string;
      totalAmount: number;
      lat: number;
      lng: number;
      telegramId?: string;
      category?: string;
    },
  ) {
    return this.paymentService.initiatePayment(body);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() body: any) {
    return this.paymentService.handleWebhook(body);
  }

  // Public — used by mini-app to poll order status without JWT
  @Get('order/:id/status')
  getOrderStatus(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.getOrderStatus(id);
  }
}
