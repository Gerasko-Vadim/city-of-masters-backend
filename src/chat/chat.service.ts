import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { ChatMessage, MessageSender } from '../order/entities/chat-message.entity';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../telegram/telegram.service';
import { Order } from '../order/entities/order.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { Client } from '../clients/entities/client.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatRepo: Repository<ChatMessage>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Specialist)
    private specialistRepo: Repository<Specialist>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    private eventsGateway: EventsGateway,
    private telegramService: TelegramService,
  ) {}

  async getHistory(orderId?: number, specialistId?: number, clientId?: number) {
    if (orderId) {
      const history = await this.chatRepo.find({
        where: { orderId },
        order: { createdAt: 'ASC' },
      });
      await this.markAsRead(orderId);
      return history;
    }
    if (specialistId) {
      const specialist = await this.specialistRepo.findOne({ where: { id: specialistId } });
      const tid = specialist?.telegramId || specialistId;
      const history = await this.chatRepo.find({
        where: { specialistId: tid as any },
        order: { createdAt: 'ASC' },
      });
      await this.markAsRead(undefined, specialistId);
      return history;
    }
    if (clientId) {
      const history = await this.chatRepo.find({
        where: { clientId },
        order: { createdAt: 'ASC' },
      });
      await this.markAsRead(undefined, undefined, clientId);
      return history;
    }
    return [];
  }

  // Helper method for older code that doesn't handle await in getHistory
  async getHistoryWithRead(orderId?: number, specialistId?: number) {
    const history = await this.getHistory(orderId, specialistId);
    await this.markAsRead(orderId, specialistId);
    return history;
  }

  async sendFromOperator(
    text: string,
    orderId?: number,
    specialistId?: number,
    clientId?: number,
    operatorId?: number,
  ) {
    let telegramId: string | number | undefined;
    let resolvedTelegramId: string | number | undefined;
    let resolvedInternalSpecialistId: number | undefined = specialistId;
    let resolvedInternalClientId: number | undefined = clientId;

    if (orderId) {
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['assignedSpecialist', 'client'],
      });
      if (order) {
        if (order.assignedSpecialist) {
          telegramId = order.assignedSpecialist.telegramId;
          resolvedTelegramId = order.assignedSpecialist.telegramId;
          resolvedInternalSpecialistId = order.assignedSpecialist.id;
        } else if (order.client) {
          telegramId = order.client.telegramId;
          resolvedInternalClientId = order.client.id;
        }
      }
    } else if (specialistId) {
      const specialist = await this.specialistRepo.findOne({
        where: { id: specialistId },
      });
      if (specialist) {
        telegramId = specialist.telegramId;
        resolvedTelegramId = specialist.telegramId;
      }
    } else if (clientId) {
      const client = await this.clientRepo.findOne({
        where: { id: clientId },
      });
      if (client) {
        telegramId = client.telegramId;
      }
    }

    const message = await this.chatRepo.save({
      orderId,
      specialistId: resolvedTelegramId as any,
      clientId: resolvedInternalClientId,
      text,
      senderType: MessageSender.OPERATOR,
      senderId: operatorId,
    });

    if (orderId) {
      this.eventsGateway.server.emit(`chat_${orderId}`, message);
    }
    if (resolvedInternalSpecialistId) {
      this.eventsGateway.server.emit(`chat_specialist_${resolvedInternalSpecialistId}`, message);
    }
    if (resolvedInternalClientId) {
      this.eventsGateway.server.emit(`chat_client_${resolvedInternalClientId}`, message);
    }

    if (telegramId) {
      await this.telegramService.sendMessage(
        telegramId as any,
        `💬 <b>Сообщение от оператора:</b>\n\n${text}`,
      );
    }

    return message;
  }

  async sendFromSpecialist(telegramId: string | number, text?: string, imageUrl?: string) {
    const specialist = await this.specialistRepo.findOne({
      where: { telegramId: telegramId as any },
    });

    if (!specialist) return null;

    const order = await this.orderRepo.findOne({
      where: {
        assignedSpecialistId: specialist.telegramId as any,
        status: 'IN_PROGRESS' as any,
      },
    });

    const processedImageUrl = await this.processImageUrl(imageUrl);

    const message = await this.chatRepo.save({
      orderId: order?.id,
      specialistId: specialist.telegramId,
      text,
      imageUrl: processedImageUrl,
      senderType: MessageSender.SPECIALIST,
      senderId: specialist.telegramId as any,
    });

    if (order) {
      this.eventsGateway.server.emit(`chat_${order.id}`, message);
    }
    this.eventsGateway.server.emit(`chat_specialist_${specialist.id}`, message);
    
    // Global notification for admin panel
    this.eventsGateway.server.emit('admin_notification', {
      type: 'CHAT_MESSAGE',
      specialistId: specialist.id,
      specialistName: specialist.name || specialist.username,
      text: text || 'Пользователь отправил фото',
      orderId: order?.id,
    });

    return message;
  }

  async sendFromClient(telegramId: string | number, text?: string, imageUrl?: string) {
    const client = await this.clientRepo.findOne({
      where: { telegramId: String(telegramId) },
    });

    if (!client) return null;

    const processedImageUrl = await this.processImageUrl(imageUrl);

    const message = await this.chatRepo.save({
      clientId: client.id,
      text,
      imageUrl: processedImageUrl,
      senderType: MessageSender.CLIENT,
      senderId: client.id,
    });

    this.eventsGateway.server.emit(`chat_client_${client.id}`, message);
    
    this.eventsGateway.server.emit('admin_notification', {
      type: 'CHAT_MESSAGE',
      clientId: client.id,
      clientName: client.firstName || client.username,
      text: text || 'Пользователь отправил фото',
    });

    return message;
  }

  async markAsRead(orderId?: number, specialistId?: number, clientId?: number) {
    if (orderId) {
      await this.chatRepo.update({ orderId, isRead: false }, { isRead: true });
    } else if (specialistId) {
      const specialist = await this.specialistRepo.findOne({ where: { id: specialistId } });
      if (specialist) {
        await this.chatRepo.update(
          { specialistId: specialist.telegramId as any, senderType: MessageSender.SPECIALIST, orderId: IsNull() },
          { isRead: true }
        );
      }
    } else if (clientId) {
      await this.chatRepo.update(
        { clientId, senderType: MessageSender.CLIENT, isRead: false },
        { isRead: true }
      );
    }
  }

  private async processImageUrl(imageUrl?: string): Promise<string | undefined> {
    if (!imageUrl) return undefined;
    if (!imageUrl.includes('api.telegram.org')) {
      return imageUrl;
    }
    try {
      const filename = crypto.randomUUID() + '.jpg';
      const uploadDir = path.join(process.cwd(), 'uploads', 'chats');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filepath = path.join(uploadDir, filename);

      const response = await axios({
        url: imageUrl,
        responseType: 'arraybuffer',
      });
      fs.writeFileSync(filepath, response.data);

      return `/chat/photo/${filename}`;
    } catch (err) {
      console.error('Failed to download image:', err);
      return imageUrl;
    }
  }
}
