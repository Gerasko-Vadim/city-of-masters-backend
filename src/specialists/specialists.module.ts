import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialistsService } from './specialists.service';
import { Specialist } from './entities/specialist.entity';
import { SpecialistsController } from './specialists.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Specialist])],
  controllers: [SpecialistsController],
  providers: [SpecialistsService],
  exports: [SpecialistsService],
})
export class SpecialistsModule {}
