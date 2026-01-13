import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialistsService } from './specialists.service';
import { Specialist } from './entities/specialist.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Specialist])],
  providers: [SpecialistsService],
  exports: [SpecialistsService],
})
export class SpecialistsModule {}
