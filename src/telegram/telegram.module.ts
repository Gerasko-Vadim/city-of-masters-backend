import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.sevice';

@Module({
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
