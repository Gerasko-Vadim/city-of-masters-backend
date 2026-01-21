import { forwardRef, Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramProcessor } from './telegram.processor';
import { BullModule } from '@nestjs/bull';
import { SpecialistsModule } from 'src/specialists/specialists.module';
import { OrderModule } from 'src/order/order.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders',
    }),
    SpecialistsModule,
    forwardRef(() => OrderModule),
  ],
  providers: [TelegramService, TelegramProcessor],
  exports: [TelegramService],
})
export class TelegramModule {}

