import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { SpecialistsService } from 'src/specialists/specialists.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private readonly specialistsService: SpecialistsService,
  ) {}

  // Создание заказа

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const orderData: DeepPartial<Order> = { ...createOrderDto };
    const order = this.orderRepository.create(orderData);
    return this.orderRepository.save(order);
  }

  // Получение всех заказов
  async findAll(): Promise<Order[]> {
    return this.orderRepository.find();
  }

  // Получение одного заказа
  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }
    return order;
  }

  // Обновление заказа
  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, updateOrderDto);
    return this.orderRepository.save(order);
  }

  // Удаление заказа
  async remove(id: number): Promise<Order> {
    const order = await this.findOne(id);
    return this.orderRepository.remove(order);
  }

  async findNearbyOrders(specialistId: number, radiusMeters = 5000) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.orderRepository.query(
      `
    SELECT o.*
    FROM orders o
    JOIN specialists s ON s.id = $1
    WHERE o.status = 'new'
    AND ST_DWithin(
      o.location,
      s.location,
      $2
    )
    ORDER BY ST_Distance(o.location, s.location)
    LIMIT 5
    `,
      [specialistId, radiusMeters],
    );
  }

  async assignToSpecialist(orderId: number, specialistId: number) {
    const order = await this.orderRepository.findOneBy({ id: orderId });

    if (!order || order.status !== OrderStatus.NEW) {
      throw new BadRequestException('Order unavailable');
    }

    order.status = OrderStatus.IN_PROGRESS;
    order.assignedSpecialist = specialistId;

    return this.orderRepository.save(order);
  }
  async acceptByTelegram(dto: AcceptOrderDto) {
    const specialist = await this.specialistsService.findByTelegramId(
      dto.telegramId,
    );

    if (!specialist) {
      throw new NotFoundException('Specialist not found');
    }

    return this.assignToSpecialist(dto.orderId, specialist.id);
  }
}
