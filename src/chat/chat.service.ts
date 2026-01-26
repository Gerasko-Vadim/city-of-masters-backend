import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, MessageSender } from '../order/entities/chat-message.entity';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../telegram/telegram.service';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatRepo: Repository<ChatMessage>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    private eventsGateway: EventsGateway,
    private telegramService: TelegramService,
  ) {}

  async getHistory(orderId: number) {
    return this.chatRepo.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  async sendFromOperator(orderId: number, text: string, operatorId?: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId }
    });

    if (!order || !order.assignedSpecialistId) return null;

    const message = await this.chatRepo.save({
      orderId,
      text,
      senderType: MessageSender.OPERATOR,
      senderId: operatorId,
    });

    // Notify Specialist via Telegram
    // We need to find the specialist's telegramId. 
    // Since Order has assignedSpecialistId, we should ideally have the specialist object or just the ID.
    // In our case, the bot knows the specialist. Let's assume we can get telegramId from a service.

    this.eventsGateway.server.emit(`chat_${orderId}`, message);

    // Get specialist's telegramId via another repo or join
    const specialistRes = await this.orderRepo.query(
        'SELECT "telegramId" FROM specialists WHERE id = $1',
        [order.assignedSpecialistId]
    );

    if (specialistRes && specialistRes[0]) {
        await this.telegramService.sendMessage(
            specialistRes[0].telegramId,
            `💬 <b>Сообщение от оператора:</b>\n\n${text}`
        );
    }

    return message;
  }

  async sendFromSpecialist(telegramId: number, text: string) {
    // Find active order for this specialist
    const specialistRes = await this.orderRepo.query(
        'SELECT id FROM specialists WHERE "telegramId" = $1',
        [telegramId]
    );

    if (!specialistRes || !specialistRes[0]) return null;
    const specialistId = specialistRes[0].id;

    const order = await this.orderRepo.findOne({
      where: { assignedSpecialistId: specialistId, status: 'IN_PROGRESS' as any }
    });

    if (!order) return null;

    const message = await this.chatRepo.save({
      orderId: order.id,
      text,
      senderType: MessageSender.SPECIALIST,
      senderId: specialistId,
    });

    this.eventsGateway.server.emit(`chat_${order.id}`, message);
    return message;
  }
}
