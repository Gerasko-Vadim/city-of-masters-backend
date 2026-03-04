import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as crypto from 'crypto';
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

  private sortKeys(obj: any): any {
    if (Array.isArray(obj)) return obj.map((v) => this.sortKeys(v));
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj)
        .sort()
        .reduce(
          (acc, k) => {
            acc[k] = this.sortKeys(obj[k]);
            return acc;
          },
          {} as Record<string, any>,
        );
    }
    return obj;
  }

  private signRequest(
    method: string,
    path: string,
    body: any,
    apiKey: string,
    timestamp: string,
    privateKeyPem: string,
  ): string {
    const host = new URL(process.env.FINIK_BASE_URL!).host;
    const sortedBody = JSON.stringify(this.sortKeys(body));
    // Headers joined with & per Finik docs
    const headersStr = `host:${host}&x-api-key:${apiKey}&x-api-timestamp:${timestamp}`;
    const canonical = [
      method.toLowerCase(),
      path,
      headersStr,
      '',
      sortedBody,
    ].join('\n');

    this.logger.log(`=== CANONICAL ===\n${canonical}\n=== END ===`);

    const pemKey = privateKeyPem.replace(/\\n/g, '\n');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(canonical);
    sign.end();
    const signature = sign.sign(pemKey, 'base64');
    this.logger.log(`Signature[:40]: ${signature.substring(0, 40)}`);
    return signature;
  }

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

    const apiKey = process.env.FINIK_API_KEY!;
    const privateKey = process.env.FINIK_PRIVATE_KEY!;
    const baseUrl = process.env.FINIK_BASE_URL!;
    const webhookUrl = process.env.FINIK_WEBHOOK_URL!;
    const redirectUrl = process.env.FINIK_REDIRECT_URL!;
    const accountId = process.env.FINIK_ACCOUNT_ID!;

    const now = new Date();
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const timestamp = now.getTime().toString(); // Unix milliseconds per Finik docs

    const body = {
      Amount: Math.round(dto.totalAmount * 100),
      CardType: 'FINIK_QR',
      PaymentId: paymentId,
      RedirectUrl: redirectUrl,
      Data: {
        accountId,
        merchantCategoryCode: '7299',
        name_en: 'City of Masters',
        webhookUrl: `${webhookUrl}/payment/webhook`,
        description: 'Комиссия за услугу',
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    const path = '/v1/payment';
    const sortedBody = this.sortKeys(body);
    const sortedBodyStr = JSON.stringify(sortedBody);
    const signature = this.signRequest('POST', path, sortedBody, apiKey, timestamp, privateKey);

    this.logger.log(`Sending body: ${sortedBodyStr}`);

    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      redirect: 'manual', // Finik returns 302, read Location header
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-api-timestamp': timestamp,
        'signature': signature, // per Finik docs (not x-signature)
      },
      body: sortedBodyStr,
    });

    this.logger.log(`Finik response status: ${response.status}`);
    this.logger.log(`Finik Location: ${response.headers.get('location') ?? 'none'}`);

    // Finik returns 302 redirect — paymentUrl is in Location header
    const paymentUrl: string =
      response.headers.get('location') ??
      response.headers.get('Location') ??
      '';

    if (!paymentUrl) {
      const text = await response.text();
      this.logger.error(`Finik API error for order ${order.id}: ${response.status} ${text}`);
      throw new Error(`Finik payment initiation failed: ${response.status}`);
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
