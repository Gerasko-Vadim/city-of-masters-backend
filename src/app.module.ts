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
import { ClientsModule } from './clients/clients.module';
import { Client } from './clients/entities/client.entity';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { InitClientChatAndOrderUpdates1740825600000 } from './migrations/1740825600000-InitClientChatAndOrderUpdates';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,

      entities: [Order, Operator, Specialist, ChatMessage, Client],
      synchronize: process.env.NODE_ENV !== 'production',
      migrations: [InitClientChatAndOrderUpdates1740825600000],
      migrationsRun: true,
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
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    OrderModule,
    OperatorsModule,
    AuthModule,
    SpecialistsModule,
    TelegramModule,
    QueueModule,
    EventsModule,
    ChatModule,
    ClientsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
