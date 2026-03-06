import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post('register')
  async register(@Body() dto: RegisterClientDto) {
    return this.clientsService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.clientsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('broadcast-status')
  getBroadcastStatus() {
    return this.clientsService.getBroadcastStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Post('broadcast-toggle')
  toggleBroadcast() {
    return this.clientsService.toggleBroadcast();
  }

  @UseGuards(JwtAuthGuard)
  @Post('broadcast-now')
  broadcastNow() {
    return this.clientsService.sendWeeklyBroadcast();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }
}
