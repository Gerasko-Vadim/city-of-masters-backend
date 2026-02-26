import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderService } from './order.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.orderService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.orderService.update(id, updateOrderDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/assign')
  assign(@Param('id', ParseIntPipe) id: number, @Body() body: { telegramId: number }) {
    return this.orderService.assign(id, body.telegramId);
  }

  // Public endpoint for Telegram bot (no JWT required)
  @Post(':id/assign-bot')
  assignFromBot(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { telegramId: number },
  ) {
    return this.orderService.assign(id, body.telegramId);
  }

  @Post(':id/complete-bot')
  completeFromBot(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { telegramId: number },
  ) {
    return this.orderService.completeByBot(id, body.telegramId);
  }

  @Get('active/:telegramId')
  findActiveOrder(@Param('telegramId') telegramId: string) {
    return this.orderService.findActiveClientOrder(telegramId);
  }
}

