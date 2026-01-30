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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { lat, lng } = job.data;

    const specialists = await this.specialistsService.findNearbySpecialists(
      lat,
      lng,
      5,
    );

    for (const s of specialists) {
      await this.telegramService.sendOrderToSpecialist(s.telegramId, job.data as Order);
    }
  }
}
