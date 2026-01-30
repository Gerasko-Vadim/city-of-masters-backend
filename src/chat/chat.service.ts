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
      return this.chatRepo.find({
        where: { orderId },
        order: { createdAt: 'ASC' },
      });
    }
    if (specialistId) {
      const specialist = await this.specialistRepo.findOne({ where: { id: specialistId } });
      const tid = specialist?.telegramId || specialistId;
      // Show all messages for this specialist on their profile page
      return this.chatRepo.find({
        where: { specialistId: tid },
        order: { createdAt: 'ASC' },
      });
    }
    return [];
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

    return message;
  }
}
