import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatMessage } from '../order/entities/chat-message.entity';
import { Order } from '../order/entities/order.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { EventsModule } from '../events/events.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, Order, Specialist]),
    EventsModule,
    TelegramModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
