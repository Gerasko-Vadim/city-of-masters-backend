import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ChatMessage, MessageSender } from '../order/entities/chat-message.entity';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../telegram/telegram.service';
import { Order } from '../order/entities/order.entity';
import { Specialist } from '../specialists/entities/specialist.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatRepo: Repository<ChatMessage>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Specialist)
    private specialistRepo: Repository<Specialist>,
    private eventsGateway: EventsGateway,
    private telegramService: TelegramService,
  ) {}

  async getHistory(orderId?: number, specialistId?: number) {
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
      // Show all messages for this specialist on their profile page
      const history = await this.chatRepo.find({
        where: { specialistId: tid },
        order: { createdAt: 'ASC' },
      });
      await this.markAsRead(undefined, specialistId);
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
    operatorId?: number,
  ) {
    let telegramId: number | undefined;
    let resolvedTelegramId: number | undefined;
    let resolvedInternalSpecialistId: number | undefined = specialistId;

    if (orderId) {
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['assignedSpecialist'],
      });
      if (order && order.assignedSpecialist) {
        telegramId = order.assignedSpecialist.telegramId;
        resolvedTelegramId = order.assignedSpecialist.telegramId;
        resolvedInternalSpecialistId = order.assignedSpecialist.id;
      }
    } else if (specialistId) {
      const specialist = await this.specialistRepo.findOne({
        where: { id: specialistId },
      });
      if (specialist) {
        telegramId = specialist.telegramId;
        resolvedTelegramId = specialist.telegramId;
      }
    }

    const message = await this.chatRepo.save({
      orderId,
      specialistId: resolvedTelegramId,
      text,
      senderType: MessageSender.OPERATOR,
      senderId: operatorId,
    });

    if (orderId) {
      console.log(`Emitting to chat_${orderId}`);
      this.eventsGateway.server.emit(`chat_${orderId}`, message);
    }
    if (resolvedInternalSpecialistId) {
      console.log(`Emitting to chat_specialist_${resolvedInternalSpecialistId}`);
      this.eventsGateway.server.emit(`chat_specialist_${resolvedInternalSpecialistId}`, message);
    }

    if (telegramId) {
      await this.telegramService.sendMessage(
        telegramId,
        `💬 <b>Сообщение от оператора:</b>\n\n${text}`,
      );
    }

    return message;
  }

  async sendFromSpecialist(telegramId: number, text: string) {
    const specialist = await this.specialistRepo.findOne({
      where: { telegramId },
    });

    if (!specialist) return null;

    const order = await this.orderRepo.findOne({
      where: {
        assignedSpecialistId: specialist.telegramId,
        status: 'IN_PROGRESS' as any,
      },
    });

    const message = await this.chatRepo.save({
      orderId: order?.id,
      specialistId: specialist.telegramId,
      text,
      senderType: MessageSender.SPECIALIST,
      senderId: specialist.telegramId,
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
      text,
      orderId: order?.id,
    });

    return message;
  }

  async markAsRead(orderId?: number, specialistId?: number) {
    if (orderId) {
      await this.chatRepo.update({ orderId, senderType: MessageSender.SPECIALIST }, { isRead: true });
    } else if (specialistId) {
      const specialist = await this.specialistRepo.findOne({ where: { id: specialistId } });
      if (specialist) {
        await this.chatRepo.update(
          { specialistId: specialist.telegramId, senderType: MessageSender.SPECIALIST, orderId: IsNull() },
          { isRead: true }
        );
      }
    }
  }
}
