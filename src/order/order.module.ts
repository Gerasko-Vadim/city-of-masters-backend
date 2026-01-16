import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderController } from './order.controller';
import { SpecialistsModule } from 'src/specialists/specialists.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    forwardRef(() => SpecialistsModule),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
