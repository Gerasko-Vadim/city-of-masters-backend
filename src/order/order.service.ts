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
import { OrderHistory } from './entities/order-history.entity';
import { SpecialistsService } from 'src/specialists/specialists.service';
import { ClientsService } from 'src/clients/clients.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/common/providers/redis.provider';
import { EventsGateway } from 'src/events/events.gateway';

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: 'Новый',
  [OrderStatus.PAID]: 'Оплачен',
  [OrderStatus.IN_PROGRESS]: 'В работе',
  [OrderStatus.COMPLETED]: 'Завершён',
};

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private historyRepository: Repository<OrderHistory>,
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

  private async addHistory(orderId: number, event: string) {
    try {
      await this.historyRepository.save({ orderId, event });
    } catch (e) {
      console.error('Failed to save order history', e);
    }
  }

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
      commission: 500,
    };
    delete orderData.telegramId;
    if (clientId) {
      orderData.clientId = clientId;
    }

    const order = await this.orderRepository.save(this.orderRepository.create(orderData));
    console.log(`Order ${order.id} created successfully`);

    await this.addHistory(order.id, `Заказ создан (источник: ${order.source === OrderSource.ADMIN ? 'Администратор' : 'Клиент'})`);

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
      await this.addHistory(order.id, 'Статус изменён: Новый → Оплачен');
      await this.telegramQueue.add('new-order', {
        id: order.id,
        lat: order.lat,
        lng: order.lng,
        address: order.address,
        totalAmount: order.totalAmount,
        description: order.description,
        category: order.category,
        phone: order.phone,
      });
    }

    this.eventsGateway.sendOrderUpdate(order);

    this.eventsGateway.server.emit('admin_notification', {
      type: 'NEW_ORDER',
      orderId: order.id,
      customerName: order.customerName,
    });

    return order;
  }

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find();
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['assignedSpecialist'],
    });
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }
    return order;
  }

  async getHistory(orderId: number): Promise<OrderHistory[]> {
    return this.historyRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  async updateNotifiedSpecialists(id: number, notifiedSpecialists: { telegramId: string; messageId: number }[]) {
    await this.orderRepository.update(id, { notifiedSpecialists });
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    console.log(`Updating order ${id} with:`, updateOrderDto);
    const order = await this.findOne(id);
    const oldStatus = order.status;

    // Collect history events by comparing old vs new values
    const historyEvents: string[] = [];

    if (updateOrderDto.status && updateOrderDto.status !== oldStatus) {
      historyEvents.push(`Статус изменён: ${statusLabel[oldStatus]} → ${statusLabel[updateOrderDto.status]}`);
    }
    if (updateOrderDto.address !== undefined && updateOrderDto.address !== order.address) {
      historyEvents.push(`Адрес изменён: "${order.address}" → "${updateOrderDto.address}"`);
    }
    if (updateOrderDto.totalAmount !== undefined && Number(updateOrderDto.totalAmount) !== Number(order.totalAmount)) {
      historyEvents.push(`Сумма изменена: ${order.totalAmount} → ${updateOrderDto.totalAmount} сом`);
    }
    if (updateOrderDto.customerName !== undefined && updateOrderDto.customerName !== order.customerName) {
      historyEvents.push(`Имя клиента: "${order.customerName}" → "${updateOrderDto.customerName}"`);
    }
    if (updateOrderDto.phone !== undefined && updateOrderDto.phone !== order.phone) {
      historyEvents.push(`Телефон изменён: ${order.phone} → ${updateOrderDto.phone}`);
    }
    if (updateOrderDto.description !== undefined && updateOrderDto.description !== order.description) {
      historyEvents.push('Описание обновлено');
    }
    if (
      updateOrderDto.lat !== undefined &&
      updateOrderDto.lng !== undefined &&
      (Number(updateOrderDto.lat) !== Number(order.lat) || Number(updateOrderDto.lng) !== Number(order.lng))
    ) {
      historyEvents.push('Координаты обновлены');
    }

    // Build safe update object (avoid TypeORM relation-save issues)
    const updates: Partial<Order> = {};
    if (updateOrderDto.customerName !== undefined) updates.customerName = updateOrderDto.customerName;
    if (updateOrderDto.phone !== undefined) updates.phone = updateOrderDto.phone;
    if (updateOrderDto.address !== undefined) updates.address = updateOrderDto.address;
    if (updateOrderDto.totalAmount !== undefined) updates.totalAmount = updateOrderDto.totalAmount;
    if (updateOrderDto.commission !== undefined) updates.commission = updateOrderDto.commission;
    if (updateOrderDto.description !== undefined) updates.description = updateOrderDto.description;
    if (updateOrderDto.status !== undefined) updates.status = updateOrderDto.status;
    if (updateOrderDto.lat !== undefined) updates.lat = updateOrderDto.lat;
    if (updateOrderDto.lng !== undefined) updates.lng = updateOrderDto.lng;

    // Reset specialist data when reverting to PAID
    if (updateOrderDto.status === OrderStatus.PAID && oldStatus !== OrderStatus.PAID) {
      updates.assignedSpecialistId = null;
      updates.startedAt = null;
      updates.completedAt = null;
    }

    await this.orderRepository.update(id, updates);
    const savedOrder = await this.findOne(id);

    console.log(`Order ${id} saved successfully (oldStatus: ${oldStatus} → ${savedOrder.status})`);

    // Save history
    for (const event of historyEvents) {
      await this.addHistory(id, event);
    }

    // If order was PAID and data fields changed → notify specialists who were notified
    const dataChanged = historyEvents.some(e => !e.startsWith('Статус'));
    if (oldStatus === OrderStatus.PAID && dataChanged) {
      const msg =
        `⚠️ <b>Заказ #${id} был изменён!</b>\n\n` +
        `📍 Адрес: ${savedOrder.address}\n` +
        `💰 Сумма: ${savedOrder.totalAmount} сом` +
        (savedOrder.description ? `\n📝 ${savedOrder.description}` : '');

      if (order.notifiedSpecialists && order.notifiedSpecialists.length > 0) {
        // Notify specialists from the saved list
        for (const ns of order.notifiedSpecialists) {
          try {
            await this.telegramService.sendToSpecialist(ns.telegramId, msg);
          } catch (e) {
            console.error(`Failed to notify specialist ${ns.telegramId} about order update`, e);
          }
        }
      } else {
        // Fallback: find and notify nearby specialists
        try {
          const nearby = await this.specialistsService.findNearbySpecialists(
            savedOrder.lat,
            savedOrder.lng,
            10,
          );
          for (const s of nearby) {
            try {
              await this.telegramService.sendToSpecialist(s.telegramId, msg);
            } catch {}
          }
        } catch (e) {
          console.error('Failed to notify nearby specialists about order update', e);
        }
      }
    }

    // If status just became PAID → notify specialists via queue and notify client
    if (oldStatus !== OrderStatus.PAID && savedOrder.status === OrderStatus.PAID) {
      console.log(`Notification trigger activated for order ${savedOrder.id}`);
      await this.telegramQueue.add('new-order', {
        id: savedOrder.id,
        lat: savedOrder.lat,
        lng: savedOrder.lng,
        address: savedOrder.address,
        totalAmount: savedOrder.totalAmount,
        description: savedOrder.description,
        category: savedOrder.category,
        phone: savedOrder.phone,
      });

      const orderWithClient = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['client'],
      });
      if (orderWithClient?.client?.telegramId) {
        await this.telegramService.sendMessage(
          orderWithClient.client.telegramId,
          `✅ <b>Оплата подтверждена — ищем мастера!</b>\n\nМы уже подбираем ближайшего специалиста для вас. Обычно это занимает до 20 минут — мы пришлём уведомление, как только мастер примет заказ 🔧`,
        );
      }
    }

    // If status just became COMPLETED → notify client
    if (oldStatus !== OrderStatus.COMPLETED && savedOrder.status === OrderStatus.COMPLETED) {
      const orderWithClient = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['client'],
      });
      if (orderWithClient?.client?.telegramId) {
        try {
          await this.telegramService.sendOrderCompletedToClient(orderWithClient.client.telegramId);
        } catch (e) {
          console.error(`Failed to send completion notification to client`, e);
        }
      }
    }

    this.eventsGateway.sendOrderUpdate(savedOrder);
    return savedOrder;
  }

  async remove(id: number): Promise<Order> {
    const order = await this.findOne(id);
    return this.orderRepository.remove(order);
  }

  async findNearbyOrders(telegramId: string | number, radiusKm = 5) {
    const specialist = await this.specialistsService.findByTelegramId(telegramId);
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

  async assign(orderId: number, telegramId: number) {
    const lockKey = `order:lock:${orderId}`;
    const lock = await this.redis.set(lockKey, String(telegramId), 'PX', 30000, 'NX');

    if (!lock) throw new ConflictException('Этот заказ уже кто-то берёт прямо сейчас');

    try {
      const order = await this.orderRepository.findOneBy({ id: orderId });

      if (!order || order.status !== OrderStatus.PAID) {
        await this.redis.del(lockKey);
        throw new ConflictException('Заказ уже взят другим мастером');
      }

      order.status = OrderStatus.IN_PROGRESS;
      order.assignedSpecialistId = String(telegramId);
      order.startedAt = new Date();
      const savedOrder = await this.orderRepository.save(order);

      const orderWithRelations = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['client', 'assignedSpecialist'],
      });

      const specName = orderWithRelations?.assignedSpecialist?.name || 'Мастер';
      await this.addHistory(orderId, `Мастер принял заказ: ${specName}`);

      if (orderWithRelations?.client?.telegramId) {
        await this.telegramService.sendMessage(
          orderWithRelations.client.telegramId,
          `👷 <b>Мастер найден!</b>\n\n${specName} взял ваш заказ и уже едет к вам. Чтобы узнать, где сейчас мастер, вы можете открыть мини-приложение и отследить его в реальном времени.`,
        );
      }

      this.eventsGateway.sendOrderUpdate(savedOrder);
      return savedOrder;
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
  }

  async notifySpecialist(telegramId: number, order: Order) {
    await this.telegramQueue.add('send-order', { telegramId, order });
  }

  async pushOrderToNearbySpecialists(order: Order): Promise<void> {
    console.log(`[PUSH] Finding specialists near ${order.lat}, ${order.lng} for order ${order.id}`);
    const specialists = await this.specialistsService.findNearbySpecialists(order.lat, order.lng, 10);
    console.log(`[PUSH] Found ${specialists.length} specialists`);

    const notified: { telegramId: string; messageId: number }[] = [];
    for (const s of specialists) {
      try {
        const messageId = await this.telegramService.sendOrderToSpecialist(s.telegramId, order);
        notified.push({ telegramId: String(s.telegramId), messageId });
        console.log(`[PUSH] Sent to specialist ${s.telegramId}`);
      } catch (e) {
        console.error(`[PUSH] Failed to send to specialist ${s.telegramId}:`, e);
      }
    }
    if (notified.length > 0) {
      await this.updateNotifiedSpecialists(order.id, notified);
    }
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

    await this.addHistory(orderId, 'Заказ завершён мастером');

    const orderWithClient = await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['client'],
    });

    if (orderWithClient?.client?.telegramId) {
      try {
        await this.telegramService.sendOrderCompletedToClient(orderWithClient.client.telegramId);
      } catch (e) {
        console.error(`Failed to send completion notification to client ${orderWithClient.client.telegramId}`, e);
      }
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
