import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AcceptOrderDto } from 'src/order/dto/accept-order.dto';
import { SpecialistsService } from './specialists.service';
import { OrderService } from 'src/order/order.service';

@Controller('specialists')
export class SpecialistsController {
  constructor(
    private readonly specialistsService: SpecialistsService,
    private readonly orderService: OrderService,
  ) {}
  @Post('register')
  async register(@Body() dto: { telegramId: number; name?: string }) {
    return this.specialistsService.register(dto);
  }

  @Post('location')
  async location(
    @Body('telegramId') telegramId: number,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    await this.specialistsService.updateLocation({ telegramId, lat, lng });
  }

  @Get('orders/nearby')
  getNearbyOrders(@Query('telegramId') telegramId: number) {
    return this.orderService.findNearbyOrders(telegramId);
  }

  @Post('orders/accept')
  acceptOrder(@Body() dto: AcceptOrderDto) {
    return this.orderService.acceptByTelegram(dto);
  }

  @Get('on-shift')
  getOnShift() {
    return this.specialistsService.findOnShift();
  }
}
