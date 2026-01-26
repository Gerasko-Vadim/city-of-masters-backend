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
  @Post('send')
  async sendFromOperator(@Body() body: { orderId: number; text: string }, @Request() req: any) {
    // req.user has the operator info
    return this.chatService.sendFromOperator(body.orderId, body.text, req.user.id);
  }

  @Post('specialist-send')
  async sendFromSpecialist(@Body() body: { telegramId: number; text: string }) {
    return this.chatService.sendFromSpecialist(body.telegramId, body.text);
  }
}
