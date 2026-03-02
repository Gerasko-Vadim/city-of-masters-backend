import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { OrderHistory } from './entities/order-history.entity';
import { OrderController } from './order.controller';
import { SpecialistsModule } from 'src/specialists/specialists.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { ClientsModule } from 'src/clients/clients.module';
import { BullModule } from '@nestjs/bull';
import { redisProvider } from 'src/common/providers/redis.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, ChatMessage, OrderHistory]),
    BullModule.registerQueue({
      name: 'orders',
    }),
    forwardRef(() => SpecialistsModule),
    forwardRef(() => TelegramModule),
    ClientsModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, redisProvider],
  exports: [OrderService],
})
export class OrderModule {}
