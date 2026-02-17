import { Body, Controller, Get, Post, Patch, Query, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { SpecialistsService } from './specialists.service';
import { OrderService } from 'src/order/order.service';

@Controller('specialists')
export class SpecialistsController {
  constructor(
    private readonly specialistsService: SpecialistsService,
    private readonly orderService: OrderService,
  ) {}
  @Get('status')
  async getStatus(@Query('telegramId') telegramId: string) {
    const specialist = await this.specialistsService.findByTelegramId(telegramId as any);
    if (!specialist) return null;
    return { isBanned: specialist.isBanned, isOnShift: specialist.isOnShift };
  }

  @Post('register')
  async register(@Body() dto: { telegramId: string; name?: string; username?: string }) {
    return this.specialistsService.register(dto as any);
  }

  @Post('location')
  async location(
    @Body('telegramId') telegramId: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    await this.specialistsService.updateLocation({ telegramId: telegramId as any, lat, lng });
  }

  @Post('offline')
  async setOffline(@Body('telegramId') telegramId: string) {
    return this.specialistsService.setOffline(telegramId as any);
  }

  @Get('orders/nearby')
  getNearbyOrders(
    @Query('telegramId') telegramId: string,
    @Query('radius') radius?: number,
  ) {
    return this.orderService.findNearbyOrders(telegramId as any, radius);
  }

  @Get('active-order')
  getActiveOrder(@Query('telegramId') telegramId: string) {
    return this.orderService.findActiveOrder(telegramId as any);
  }

  @Get('on-shift')
  getOnShift() {
    return this.specialistsService.findOnShift();
  }

  @Get()
  async getAll() {
    return this.specialistsService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const specialist = await this.specialistsService.findOneById(id);
    if (!specialist) {
      throw new NotFoundException('Specialist not found');
    }
    const orders = await this.orderService.findBySpecialist(specialist.telegramId);
    const activeOrder = await this.orderService.findActiveOrder(specialist.telegramId);
    return { ...specialist, orders, activeOrder };
  }

  @Patch(':id/ban')
  async ban(@Param('id', ParseIntPipe) id: number, @Body('isBanned') isBanned: boolean) {
    return this.specialistsService.setBan(id, isBanned);
  }
}

