// src/auth/auth.controller.ts
import { Controller, Post, Body, Res } from '@nestjs/common';
import { type Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken } = await this.authService.login(
      body.username,
      body.password,
    );

    res.cookie('token', accessToken, {
      httpOnly: true, // ❗ JS не видит — безопасно
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    return { success: true };
  }
}
