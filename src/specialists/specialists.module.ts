import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialistsService } from './specialists.service';
import { Specialist } from './entities/specialist.entity';
import { SpecialistsController } from './specialists.controller';
import { OrderModule } from 'src/order/order.module';
import { TelegramModule } from 'src/telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Specialist]),
    forwardRef(() => OrderModule),
    forwardRef(() => TelegramModule),
  ],
  controllers: [SpecialistsController],
  providers: [SpecialistsService],
  exports: [SpecialistsService],
})
export class SpecialistsModule {}
