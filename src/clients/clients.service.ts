import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
  ) {}

  async findOrCreate(telegramId: number, name?: string, username?: string) {
    let client = await this.clientsRepository.findOne({ where: { telegramId } });
    if (!client) {
      client = this.clientsRepository.create({
        telegramId,
        name,
        username,
      });
      await this.clientsRepository.save(client);
    } else if ((name && client.name !== name) || (username && client.username !== username)) {
      if (name) client.name = name;
      if (username) client.username = username;
      await this.clientsRepository.save(client);
    }
    return client;
  }

  async findByTelegramId(telegramId: number) {
    return this.clientsRepository.findOne({ where: { telegramId } });
  }
}
