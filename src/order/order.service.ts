import {
  ConflictException,
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
import { TelegramService } from 'src/telegram/telegram.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/common/providers/redis.provider';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @Inject(forwardRef(() => SpecialistsService))
    private readonly specialistsService: SpecialistsService,
    private readonly telegramService: TelegramService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @InjectQueue('orders')
    private readonly telegramQueue: Queue,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateOrderDto) {
    const order = await this.orderRepository.save(dto);

    if (order.status === OrderStatus.PAID) {
      await this.telegramQueue.add('new-order', {
        id: order.id,
        lat: order.lat,
        lng: order.lng,
        address: order.address,
        totalAmount: order.totalAmount,
      });
    }

    this.eventsGateway.sendOrderUpdate(order);

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
    const oldStatus = order.status;

    Object.assign(order, updateOrderDto);
    const savedOrder = await this.orderRepository.save(order);

    // Если статус изменился на PAID, запускаем поиск исполнителей
    if (oldStatus !== OrderStatus.PAID && savedOrder.status === OrderStatus.PAID) {
      await this.telegramQueue.add('new-order', {
        id: savedOrder.id,
        lat: savedOrder.lat,
        lng: savedOrder.lng,
        address: savedOrder.address,
        totalAmount: savedOrder.totalAmount,
      });
    }

    this.eventsGateway.sendOrderUpdate(savedOrder);
    return savedOrder;
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
      .andWhere('order.status = :status', { status: OrderStatus.PAID })
      .getMany();
  }

  // async assign(orderId: number, telegramId: number) {
  //   const specialist =
  //     await this.specialistsService.findByTelegramId(telegramId);
  //   const order = await this.orderRepository.findOneBy({ id: orderId });

  //   if (!order) {
  //     throw new NotFoundException('Order not found');
  //   }

  //   order.status = OrderStatus.IN_PROGRESS;
  //   order.assignedSpecialist = specialist?.telegramId;

  //   return this.orderRepository.save(order);
  // }

  async assign(orderId: number, telegramId: number) {
    const lockKey = `order:lock:${orderId}`;
    // Try to acquire lock with 10 second expiration
    const lock = await this.redis.set(
      lockKey,
      String(telegramId),
      'PX',
      10000,
      'NX',
    );

    if (!lock) throw new ConflictException('Order already taken');

    try {
      const order = await this.orderRepository.findOneBy({ id: orderId });

      if (!order || order.status !== OrderStatus.PAID) {
        // Release lock if order is invalid
        await this.redis.del(lockKey);
        throw new ConflictException('Order not available (must be PAID)');
      }

      order.status = OrderStatus.IN_PROGRESS;
      order.assignedSpecialistId = telegramId;
      order.startedAt = new Date();
      const savedOrder = await this.orderRepository.save(order);
      this.eventsGateway.sendOrderUpdate(savedOrder);
      return savedOrder;
    } catch (error) {
      // Release lock on error
      await this.redis.del(lockKey);
      throw error;
    }
  }

  async notifySpecialist(telegramId: number, order: Order) {
    await this.telegramQueue.add('send-order', {
      telegramId,
      order,
    });
  }

  async findActiveOrder(telegramId: number): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: {
        assignedSpecialistId: telegramId,
        status: OrderStatus.IN_PROGRESS,
      },
    });
  }

  async findBySpecialist(telegramId: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { assignedSpecialistId: telegramId },
      order: { createdAt: 'DESC' },
    });
  }

  async completeByBot(orderId: number, telegramId: number): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.assignedSpecialistId !== telegramId) {
      throw new ConflictException('You are not assigned to this order');
    }

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new ConflictException('Order is not in progress');
    }

    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    const savedOrder = await this.orderRepository.save(order);
    this.eventsGateway.sendOrderUpdate(savedOrder);
    return savedOrder;
  }
}
