import { Process, Processor } from '@nestjs/bull';
import { Order } from 'src/order/entities/order.entity';
import { SpecialistsService } from 'src/specialists/specialists.service';
import { TelegramService } from './telegram.service';
import { Job } from 'bullmq';

@Processor('orders')
export class TelegramProcessor {
  constructor(
    private readonly specialistsService: SpecialistsService,
    private readonly telegramService: TelegramService,
  ) {}

  @Process('new-order')
  async handle(job: Job) {
    console.log(`TelegramProcessor: handling new-order for order ${job.data.id}`);
    const { lat, lng } = job.data;
    console.log(`Searching specialists near ${lat}, ${lng}`);

    const specialists = await this.specialistsService.findNearbySpecialists(
      lat,
      lng,
      10, // Increased radius to 10 for testing
    );

    console.log(`Found ${specialists.length} nearby specialists`);

    for (const s of specialists) {
      console.log(`Sending order to specialist ${s.telegramId}`);
      await this.telegramService.sendOrderToSpecialist(s.telegramId, job.data as Order);
    }
  }
}
