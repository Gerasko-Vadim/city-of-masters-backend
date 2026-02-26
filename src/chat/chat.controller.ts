import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':orderId')
  async getHistory(@Param('orderId') orderId: string) {
    return this.chatService.getHistory(Number(orderId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('client/:clientId')
  async getClientHistory(@Param('clientId') clientId: string) {
    return this.chatService.getHistory(undefined, undefined, Number(clientId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('send')
  async sendFromOperator(
    @Body() body: { orderId?: number; specialistId?: number; clientId?: number; text: string },
    @Request() req: any,
  ) {
    // req.user has the operator info
    return this.chatService.sendFromOperator(
      body.text,
      body.orderId,
      body.specialistId,
      body.clientId,
      req.user.id,
    );
  }

  @Post('client-send')
  async sendFromClient(@Body() body: { telegramId: number; text: string }) {
    return this.chatService.sendFromClient(body.telegramId, body.text);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-as-read')
  async markAsRead(@Body() body: { orderId?: number; specialistId?: number; clientId?: number }) {
    return this.chatService.markAsRead(body.orderId, body.specialistId, body.clientId);
  }
}
