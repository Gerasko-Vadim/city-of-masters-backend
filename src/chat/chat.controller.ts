import { Controller, Get, Post, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('photo/:filename')
  servePhoto(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(process.cwd(), 'uploads', 'chats', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }
    res.sendFile(filePath);
  }

  @UseGuards(JwtAuthGuard)
  @Get('specialist/:specialistId')
  async getSpecialistHistory(@Param('specialistId') specialistId: string) {
    return this.chatService.getHistory(undefined, Number(specialistId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('client/:clientId')
  async getClientHistory(@Param('clientId') clientId: string) {
    return this.chatService.getHistory(undefined, undefined, Number(clientId));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orderId')
  async getHistory(@Param('orderId') orderId: string) {
    return this.chatService.getHistory(Number(orderId));
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
  async sendFromClient(@Body() body: { telegramId: number; text?: string; imageUrl?: string }) {
    return this.chatService.sendFromClient(body.telegramId, body.text, body.imageUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-as-read')
  async markAsRead(@Body() body: { orderId?: number; specialistId?: number; clientId?: number }) {
    return this.chatService.markAsRead(body.orderId, body.specialistId, body.clientId);
  }
}
