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
import { Order, OrderStatus, OrderSource } from './entities/order.entity';
import { SpecialistsService } from 'src/specialists/specialists.service';
import { ClientsService } from 'src/clients/clients.service';
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
    private readonly clientsService: ClientsService,
    private readonly telegramService: TelegramService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @InjectQueue('orders')
    private readonly telegramQueue: Queue,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateOrderDto) {
    let clientId = dto.clientId;
    if (dto.telegramId) {
      const client = await this.clientsService.register({
        telegramId: dto.telegramId,
        name: dto.customerName,
        phone: dto.phone,
      });
      clientId = client.id;
    }

    const orderData = { 
      ...dto,
      source: (dto.source as OrderSource) || OrderSource.CLIENT,
      commission: 500
    };
    delete orderData.telegramId;
    if (clientId) {
      orderData.clientId = clientId;
    }

    const order = await this.orderRepository.save(this.orderRepository.create(orderData));
    console.log(`Order ${order.id} created successfully`);

    if (dto.telegramId) {
      try {
        await this.telegramService.sendMessage(
          dto.telegramId,
          `📝 <b>Заказ №${order.id} успешно создан!</b>\n\nДля начала поиска мастера, пожалуйста, отправьте скриншот оплаты (500 сом) в этот чат.\n\nКак только мы подтвердим оплату, поиск начнется автоматически.`,
        );
      } catch (err) {
        console.error(`Failed to send order creation notification to ${dto.telegramId}`, err);
      }
    }

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
    
    // Notify admin panel about new order for sound alert
    this.eventsGateway.server.emit('admin_notification', {
      type: 'NEW_ORDER',
      orderId: order.id,
      customerName: order.customerName,
    });

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
    console.log(`Updating order ${id} with:`, updateOrderDto);
    const order = await this.findOne(id);
    const oldStatus = order.status;

    Object.assign(order, updateOrderDto);

    // Если статус меняется на PAID (даже если он был COMPLETED или IN_PROGRESS)
    // Сбрасываем данные о мастере и времени, чтобы заказ стал "чистым" для нового поиска
    if (updateOrderDto.status === OrderStatus.PAID && oldStatus !== OrderStatus.PAID) {
      order.assignedSpecialistId = null;
      order.startedAt = null;
      order.completedAt = null;
      // Также можно сбросить и другие поля, если нужно
    }

    const savedOrder = await this.orderRepository.save(order);
    console.log(`Order ${id} saved successfully with status ${savedOrder.status} (oldStatus: ${oldStatus})`);

    // Если статус стал PAID, запускаем поиск исполнителей и уведомляем клиента
    if (oldStatus !== OrderStatus.PAID && savedOrder.status === OrderStatus.PAID) {
      console.log(`Notification trigger activated for order ${savedOrder.id}`);
      await this.telegramQueue.add('new-order', {
        id: savedOrder.id,
        lat: savedOrder.lat,
        lng: savedOrder.lng,
        address: savedOrder.address,
        totalAmount: savedOrder.totalAmount,
      });

      // Уведомление клиента
      const orderWithClient = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['client'],
      });
      if (orderWithClient?.client?.telegramId) {
        await this.telegramService.sendMessage(
          orderWithClient.client.telegramId,
          `✅ <b>Поиск мастера возобновлен!</b>\n\nСтатус вашего заказа №${savedOrder.id} изменен на «Поиск мастера». Мы снова ищем ближайшего специалиста для вас.`,
        );
      }
    }

    this.eventsGateway.sendOrderUpdate(savedOrder);
    return savedOrder;
  }

  // Удаление заказа
  async remove(id: number): Promise<Order> {
    const order = await this.findOne(id);
    return this.orderRepository.remove(order);
  }

  async findNearbyOrders(telegramId: string | number, radiusKm = 5) {
    const specialist =
      await this.specialistsService.findByTelegramId(telegramId);
    if (!specialist || !specialist.lat || !specialist.lng) return [];

    return this.orderRepository
      .createQueryBuilder('order')
      .addSelect(
        `
        6371 * acos(
          cos(radians(:lat)) * cos(radians(order.lat)) *
          cos(radians(order.lng) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(order.lat))
        )
      `,
        'distance',
      )
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
      .orderBy('distance', 'ASC')
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
      30000,
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
      order.assignedSpecialistId = String(telegramId);
      order.startedAt = new Date();
      const savedOrder = await this.orderRepository.save(order);
      
      // Уведомление клиента о назначении мастера
      const orderWithRelations = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['client', 'assignedSpecialist'],
      });
      if (orderWithRelations?.client?.telegramId) {
        const specName = orderWithRelations.assignedSpecialist?.name || 'Мастер';
        await this.telegramService.sendMessage(
          orderWithRelations.client.telegramId,
          `👷 <b>Мастер найден!</b>\n\n${specName} взял ваш заказ и уже едет к вам. Чтобы узнать, где сейчас мастер, вы можете открыть мини-приложение и отследить его в реальном времени.`,
        );
      }

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

  async findActiveOrder(telegramId: string | number): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: {
        assignedSpecialistId: telegramId as any,
        status: OrderStatus.IN_PROGRESS,
      },
    });
  }

  async findBySpecialist(telegramId: string | number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { assignedSpecialistId: telegramId as any },
      order: { createdAt: 'DESC' },
    });
  }

  async completeByBot(orderId: number, telegramId: number): Promise<Order> {
    const order = await this.findOne(orderId);
    
    if (String(order.assignedSpecialistId) !== String(telegramId)) {
      throw new ConflictException('You are not assigned to this order');
    }

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new ConflictException('Order is not in progress');
    }

    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    const savedOrder = await this.orderRepository.save(order);
    
    // Уведомление клиента о завершении заказа
    const orderWithClient = await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['client'],
    });

    if (orderWithClient?.client?.telegramId) {
      await this.telegramService.sendMessage(
        orderWithClient.client.telegramId,
        `✅ <b>Заказ завершен!</b>\n\nБлагодарим вас за то, что выбрали наш сервис! Мы будем рады видеть вас снова. Желаем вам прекрасного дня! 😊`,
      );
    }

    this.eventsGateway.sendOrderUpdate(savedOrder);
    return savedOrder;
  }

  async findActiveClientOrder(telegramId: string): Promise<Order | null> {
    const client = await this.clientsService.findByTelegramId(telegramId);
    if (!client) return null;

    return this.orderRepository.findOne({
      where: [
        { clientId: client.id, status: OrderStatus.PAID },
        { clientId: client.id, status: OrderStatus.IN_PROGRESS },
      ],
      relations: ['assignedSpecialist'],
      order: { createdAt: 'DESC' },
    });
  }
}
