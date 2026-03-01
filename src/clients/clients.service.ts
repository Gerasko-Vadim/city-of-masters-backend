import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { RegisterClientDto } from './dto/register-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async findByTelegramId(telegramId: string) {
    return this.clientRepository.findOne({ where: { telegramId } });
  }

  async register(dto: RegisterClientDto) {
    let client = await this.findByTelegramId(dto.telegramId);

    const firstName = dto.firstName || dto.name;

    if (client) {
      client.firstName = firstName || client.firstName;
      client.lastName = dto.lastName || client.lastName;
      client.username = dto.username || client.username;
      client.phone = dto.phone || client.phone;
      return this.clientRepository.save(client);
    }

    client = this.clientRepository.create({
      ...dto,
      firstName,
    });
    return this.clientRepository.save(client);
  }

  async findOne(id: number) {
    return this.clientRepository.findOne({ 
      where: { id },
      relations: ['orders']
    });
  }

  async findAll() {
    const clients = await this.clientRepository.find({
      relations: ['orders', 'chatMessages'],
      order: { createdAt: 'DESC' },
    });

    return clients.map((client) => {
      const hasNewOrder = client.orders.some((o) => o.status === 'NEW');
      const unreadCount = client.chatMessages.filter(
        (m) => !m.isRead && m.senderType === 'CLIENT',
      ).length;

      return {
        ...client,
        hasNewOrder,
        unreadCount,
        // Remove large relations to keep response size manageable if needed, 
        // but here it's likely fine for the admin panel.
        orders: undefined,
        chatMessages: undefined,
      };
    });
  }
}
