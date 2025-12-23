// src/operators/operators.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from './entities/operator.entity';
import { UpdateOperatorDto } from './dto/update-operator.dto';

@Injectable()
export class OperatorsService {
  constructor(
    @InjectRepository(Operator)
    private operatorsRepo: Repository<Operator>,
  ) {}

  findByUsername(username: string) {
    return this.operatorsRepo.findOne({ where: { username } });
  }

  findById(id: number) {
    return this.operatorsRepo.findOne({ where: { id } });
  }

  create(operator: Partial<Operator>) {
    const op = this.operatorsRepo.create(operator);
    return this.operatorsRepo.save(op);
  }

  findAll() {
    return this.operatorsRepo.find({
      select: ['id', 'username', 'isActive', 'createdAt'],
    });
  }

  async update(id: number, dto: UpdateOperatorDto): Promise<Operator> {
    const operator = await this.findById(id);

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    Object.assign(operator, dto);

    return this.operatorsRepo.save(operator);
  }
}
