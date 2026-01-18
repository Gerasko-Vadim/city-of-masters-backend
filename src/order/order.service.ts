import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { SpecialistsService } from 'src/specialists/specialists.service';
import { TelegramService } from 'src/telegram/telegram.sevice';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @Inject(forwardRef(() => SpecialistsService))
    private readonly specialistsService: SpecialistsService,
    private readonly telegramService: TelegramService,
  ) {}

  // Создание заказа

  // async create(createOrderDto: CreateOrderDto): Promise<Order> {
  //   const orderData: DeepPartial<Order> = { ...createOrderDto };
  //   const order = this.orderRepository.create(orderData);
  //   return this.orderRepository.save(order);
  // }

  async create(dto: CreateOrderDto) {
    const order = await this.orderRepository.save(dto);

    const specialists = await this.specialistsService.findNearbySpecialists(
      order.lat,
      order.lng,
      5,
    );

    for (const s of specialists) {
      await this.telegramService.sendOrderToSpecialist(s.telegramId, order);
    }

    return order;
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

  async findNearbyOrders(telegramId: number) {
    const specialist =
      await this.specialistsService.findByTelegramId(telegramId);
    if (!specialist || !specialist.lat || !specialist.lng) return [];

    const radiusKm = 5;

    return this.orderRepository
      .createQueryBuilder('order')
      .where(
        `
      6371 * acos(
        cos(radians(:lat)) * cos(radians(order.lat)) *
        cos(radians(order.lng) - radians(:lng)) +
        sin(radians(:lat)) * sin(radians(order.lat))
      ) < :radius
    `,
        { lat: specialist.lat, lng: specialist.lng, radius: radiusKm },
      )
      .andWhere('order.status = :status', { status: 'NEW' })
      .getMany();
  }

  async assign(orderId: number, telegramId: number) {
    const specialist =
      await this.specialistsService.findByTelegramId(telegramId);
    const order = await this.orderRepository.findOneBy({ id: orderId });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = OrderStatus.IN_PROGRESS;
    order.assignedSpecialist = specialist?.telegramId;

    return this.orderRepository.save(order);
  }
}
