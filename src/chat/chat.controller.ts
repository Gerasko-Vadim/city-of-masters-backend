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
  @Get('specialist/:specialistId')
  async getSpecialistHistory(@Param('specialistId') specialistId: string) {
    return this.chatService.getHistory(undefined, Number(specialistId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('send')
  async sendFromOperator(
    @Body() body: { orderId?: number; specialistId?: number; text: string },
    @Request() req: any,
  ) {
    // req.user has the operator info
    return this.chatService.sendFromOperator(
      body.text,
      body.orderId,
      body.specialistId,
      req.user.id,
    );
  }

  @Post('specialist-send')
  async sendFromSpecialist(@Body() body: { telegramId: number; text: string }) {
    return this.chatService.sendFromSpecialist(body.telegramId, body.text);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-as-read')
  async markAsRead(@Body() body: { orderId?: number; specialistId?: number }) {
    return this.chatService.markAsRead(body.orderId, body.specialistId);
  }
}
