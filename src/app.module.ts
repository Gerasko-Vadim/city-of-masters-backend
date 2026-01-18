import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrderModule } from './order/order.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorsModule } from './operators/operators.module';
import { AuthModule } from './auth/auth.module';
import { Order } from './order/entities/order.entity';
import { Operator } from './operators/entities/operator.entity';
import { SpecialistsModule } from './specialists/specialists.module';
import { Specialist } from './specialists/entities/specialist.entity';
import { TelegramModule } from './telegram/telegram.module';

console.log('DATABASE_URL:', process.env.DATABASE_URL);
@Module({
  imports: [
    OrderModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,

      entities: [Order, Operator, Specialist],
      synchronize: true,
      dropSchema: true,
      ssl: false,
    }),

    OperatorsModule,
    AuthModule,
    SpecialistsModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
