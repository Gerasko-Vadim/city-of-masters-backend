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
    return this.clientRepository.findOne({ where: { id } });
  }

  async findAll() {
    return this.clientRepository.find({ order: { createdAt: 'DESC' } });
  }
}
