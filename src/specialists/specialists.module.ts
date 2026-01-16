import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialistsService } from './specialists.service';
import { Specialist } from './entities/specialist.entity';
import { SpecialistsController } from './specialists.controller';
import { OrderModule } from 'src/order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Specialist]),
    forwardRef(() => OrderModule),
  ],
  controllers: [SpecialistsController],
  providers: [SpecialistsService],
  exports: [SpecialistsService],
})
export class SpecialistsModule {}
