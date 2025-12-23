// src/operators/operators.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterOperatorDto } from '../auth/dto/register-operator.dto';
import * as bcrypt from 'bcrypt';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { Operator } from './entities/operator.entity';

@Controller('operators')
export class OperatorsController {
  constructor(private operatorsService: OperatorsService) {}

  // Текущий оператор
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    return this.operatorsService.findById(req.user.id);
  }

  // Список операторов
  @UseGuards(JwtAuthGuard)
  @Get()
  getAll() {
    return this.operatorsService.findAll();
  }

  // Создать оператора
  @UseGuards(JwtAuthGuard)
  @Post()
  async createOperator(@Body() dto: RegisterOperatorDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.operatorsService.create({
      username: dto.username,
      passwordHash,
    });
  }

  // Активировать / деактивировать
  @UseGuards(JwtAuthGuard)
  @Patch(':id/active')
  setActive(@Param('id') id: number, @Body() body: { isActive: boolean }) {
    return this.operatorsService.update(id, { isActive: body.isActive });
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperatorDto,
  ): Promise<Operator> {
    return this.operatorsService.update(id, dto);
  }
}
