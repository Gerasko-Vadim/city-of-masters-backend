import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrderModule } from './order/order.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order/entities/order.entity';

@Module({
  imports: [
    OrderModule,
    OrderModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'city_of_masters',
      entities: [Order],
      synchronize: true, // ⚠️ только для dev
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
