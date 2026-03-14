import { Process, Processor } from '@nestjs/bull';
import { forwardRef, Inject } from '@nestjs/common';
import { Order } from 'src/order/entities/order.entity';
import { OrderService } from 'src/order/order.service';
import { SpecialistsService } from 'src/specialists/specialists.service';
import { TelegramService } from './telegram.service';
import type { Job } from 'bull';

@Processor('orders')
export class TelegramProcessor {
  constructor(
    private readonly specialistsService: SpecialistsService,
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  @Process('new-order')
  async handle(job: Job<any>) {
    console.log(`TelegramProcessor: handling new-order for order ${job.data.id}`);
    const { lat, lng } = job.data;
    console.log(`Searching specialists near ${lat}, ${lng}`);

    const specialists = await this.specialistsService.findNearbySpecialists(lat, lng, 5);

    console.log(`Found ${specialists.length} nearby specialists`);

    const notifiedSpecialists: { telegramId: string; messageId: number }[] = [];

    for (const s of specialists) {
      console.log(`Sending order to specialist ${s.telegramId}`);
      try {
        const messageId = await this.telegramService.sendOrderToSpecialist(s.telegramId, job.data as unknown as Order);
        notifiedSpecialists.push({ telegramId: String(s.telegramId), messageId });
      } catch (e) {
        console.error(`Failed to send order to specialist ${s.telegramId}`, e);
      }
    }

    if (notifiedSpecialists.length > 0) {
      try {
        await this.orderService.updateNotifiedSpecialists(job.data.id, notifiedSpecialists);
      } catch (e) {
        console.error('Failed to update notifiedSpecialists on order', e);
      }
    }
  }
}
