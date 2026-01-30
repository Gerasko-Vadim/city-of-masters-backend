import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrderModule } from './order/order.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorsModule } from './operators/operators.module';
import { AuthModule } from './auth/auth.module';
import { Order } from './order/entities/order.entity';
import { ChatMessage } from './order/entities/chat-message.entity';
import { Operator } from './operators/entities/operator.entity';
import { SpecialistsModule } from './specialists/specialists.module';
import { Specialist } from './specialists/entities/specialist.entity';
import { TelegramModule } from './telegram/telegram.module';
import { QueueModule } from './queue/queue.module';
import { BullModule } from '@nestjs/bull';
import { EventsModule } from './events/events.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,

      entities: [Order, Operator, Specialist, ChatMessage],
      synchronize: true,
      ssl: { rejectUnauthorized: false },
    }),
    BullModule.forRootAsync({
      useFactory: () => {
        if (process.env.REDIS_URL) {
          return { redis: process.env.REDIS_URL };
        }
        return {
          redis: {
            host:
              process.env.REDISHOST || process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(
              process.env.REDISPORT || process.env.REDIS_PORT || '6379',
              10,
            ),
            password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD,
          },
        };
      },
    }),
    OrderModule,
    OperatorsModule,
    AuthModule,
    SpecialistsModule,
    TelegramModule,
    QueueModule,
    EventsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
