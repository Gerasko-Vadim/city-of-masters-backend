// src/operators/operators.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorsService } from './operators.service';
import { Operator } from './entities/operator.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Operator])],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
