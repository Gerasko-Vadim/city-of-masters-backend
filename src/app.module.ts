import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrderModule } from './order/order.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorsModule } from './operators/operators.module';
import { AuthModule } from './auth/auth.module';
import { Order } from './order/entities/order.entity';
import { Operator } from './operators/entities/operator.entity';

@Module({
  imports: [
    OrderModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,

      entities: [Order, Operator],

      synchronize: true, // ⚠️ ok для MVP
      ssl: {
        rejectUnauthorized: false,
      },
    }),

    OperatorsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
