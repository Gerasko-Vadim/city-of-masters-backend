import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards, Delete, BadRequestException } from '@nestjs/common';
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
  broadcastNow(@Body() body: { text?: string }) {
    return this.clientsService.sendWeeklyBroadcast(body?.text);
  }

  @UseGuards(JwtAuthGuard)
  @Get('broadcast-auto-text')
  getAutoText() {
    return this.clientsService.getAutoText();
  }

  @UseGuards(JwtAuthGuard)
  @Post('broadcast-auto-text')
  setAutoText(@Body() body: { text: string; buttonVisible: boolean }) {
    return this.clientsService.setAutoText(body.text, body.buttonVisible ?? true);
  }

  @UseGuards(JwtAuthGuard)
  @Post('broadcast-schedule')
  scheduleBroadcast(@Body() body: { text: string; scheduledAt: string }) {
    try {
      return this.clientsService.scheduleCustomBroadcast(body.text, new Date(body.scheduledAt));
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('broadcast-scheduled')
  getScheduled() {
    return this.clientsService.getScheduledBroadcasts();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('broadcast-scheduled/:id')
  cancelScheduled(@Param('id') id: string) {
    return this.clientsService.cancelScheduledBroadcast(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }
}
