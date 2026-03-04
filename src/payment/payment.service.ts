import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as crypto from 'crypto';
import { Signer } from '@mancho.devs/authorizer';
import type { RequestData } from '@mancho.devs/authorizer/dist/types';
import { Order, OrderStatus, OrderSource } from '../order/entities/order.entity';
import { ClientsService } from '../clients/clients.service';
import { TelegramService } from '../telegram/telegram.service';
import { EventsGateway } from '../events/events.gateway';

interface InitiatePaymentDto {
  customerName: string;
  phone: string;
  address: string;
  description?: string;
  totalAmount: number;
  lat: number;
  lng: number;
  telegramId?: string;
  category?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly clientsService: ClientsService,
    private readonly telegramService: TelegramService,
    @InjectQueue('orders')
    private readonly telegramQueue: Queue,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async initiatePayment(
    dto: InitiatePaymentDto,
  ): Promise<{ orderId: number; paymentUrl: string }> {
    let clientId: number | undefined;
    if (dto.telegramId) {
      const client = await this.clientsService.register({
        telegramId: dto.telegramId,
        name: dto.customerName,
        phone: dto.phone,
      });
      clientId = client.id;
    }

    const paymentId = crypto.randomUUID();

    const orderData: Partial<Order> = {
      customerName: dto.customerName,
      phone: dto.phone,
      address: dto.address,
      description: dto.description,
      totalAmount: dto.totalAmount,
      lat: dto.lat,
      lng: dto.lng,
      category: dto.category,
      source: OrderSource.CLIENT,
      commission: 500,
      status: OrderStatus.NEW,
      finikPaymentId: paymentId,
      ...(clientId ? { clientId } : {}),
    };

    const order = await this.orderRepository.save(
      this.orderRepository.create(orderData),
    );
    this.logger.log(`Order ${order.id} created with Finik paymentId ${paymentId}`);

    // Credentials
    const baseUrl = process.env.FINIK_BASE_URL!;
    const apiKey = process.env.FINIK_API_KEY!;
    const privateKey = process.env.FINIK_PRIVATE_KEY!.replace(/\\n/g, '\n');
    const accountId = process.env.FINIK_ACCOUNT_ID!;
    const webhookUrl = process.env.FINIK_WEBHOOK_URL!;
    const redirectUrl = process.env.FINIK_REDIRECT_URL!;

    const host = new URL(baseUrl).host;
    const timestamp = Date.now().toString(); // UNIX ms

    const now = Date.now();
    const body = {
      Amount: Math.round(dto.totalAmount),
      CardType: 'FINIK_QR',
      PaymentId: paymentId,
      RedirectUrl: redirectUrl,
      Data: {
        accountId,
        merchantCategoryCode: '7299',
        name_en: 'Город Мастеров',
        webhookUrl: `${webhookUrl}/payment/webhook`,
        description: 'Комиссия за услугу',
        startDate: now,
        endDate: now + 24 * 60 * 60 * 1000,
      },
    };

    const requestData: RequestData = {
      httpMethod: 'POST',
      path: '/v1/payment',
      headers: {
        Host: host,
        'x-api-key': apiKey,
        'x-api-timestamp': timestamp,
      },
      queryStringParameters: null,
      body,
    };

    this.logger.log(`Request body: ${JSON.stringify(body)}`);

    const signature = await new Signer(requestData).sign(privateKey);
    this.logger.log(`Signature[:40]: ${signature.substring(0, 40)}`);

    const url = `${baseUrl}${requestData.path}`;
    const res = await fetch(url, {
      method: requestData.httpMethod,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'x-api-timestamp': timestamp,
        signature,
      },
      body: JSON.stringify(body),
      redirect: 'manual',
    });

    this.logger.log(`Finik response status: ${res.status}`);
    this.logger.log(`Finik Location: ${res.headers.get('location') ?? 'none'}`);

    if (res.status === 302) {
      const paymentUrl = res.headers.get('location') ?? '';
      if (!paymentUrl) {
        throw new Error('Finik returned 302 but no Location header');
      }
      this.logger.log(`Finik paymentUrl for order ${order.id}: ${paymentUrl}`);

      this.eventsGateway.sendOrderUpdate(order);
      this.eventsGateway.server.emit('admin_notification', {
        type: 'NEW_ORDER',
        orderId: order.id,
        customerName: order.customerName,
      });

      return { orderId: order.id, paymentUrl };
    }

    const text = await res.text();
    this.logger.error(`Finik API error for order ${order.id}: ${res.status} ${text}`);
    throw new Error(`Finik payment initiation failed: ${res.status} ${text}`);
  }

  async handleWebhook(body: any): Promise<void> {
    const paymentId: string = body.paymentId ?? body.PaymentId;
    if (!paymentId) {
      this.logger.warn('Finik webhook received without paymentId');
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { finikPaymentId: paymentId },
      relations: ['client'],
    });

    if (!order) {
      this.logger.warn(`No order found for finikPaymentId: ${paymentId}`);
      return;
    }

    if (order.status === OrderStatus.PAID) {
      this.logger.log(`Order ${order.id} already PAID — skipping duplicate webhook`);
      return;
    }

    order.status = OrderStatus.PAID;
    const savedOrder = await this.orderRepository.save(order);
    this.logger.log(`Order ${savedOrder.id} marked PAID via Finik webhook`);

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

    if (order.client?.telegramId) {
      try {
        await this.telegramService.sendMessage(
          order.client.telegramId,
          `✅ <b>Оплата подтверждена — ищем мастера!</b>\n\nМы уже подбираем ближайшего специалиста для вас. Обычно это занимает до 20 минут — мы пришлём уведомление, как только мастер примет заказ 🔧`,
        );
      } catch (e) {
        this.logger.error(
          `Failed to notify client ${order.client.telegramId} about PAID status`,
          e,
        );
      }
    }

    this.eventsGateway.sendOrderUpdate(savedOrder);
  }
}
