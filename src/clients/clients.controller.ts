import { Controller, Post, Body } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post('register')
  async register(
    @Body() data: { telegramId: number; name?: string; username?: string },
  ) {
    return this.clientsService.findOrCreate(
      data.telegramId,
      data.name,
      data.username,
    );
  }
}
