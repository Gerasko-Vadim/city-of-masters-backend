import { Injectable } from '@nestjs/common';
import { Order } from 'src/order/entities/order.entity';
import { Telegraf, Markup } from 'telegraf';

// Specialist bot (where masters receive orders)
export const specialistBot = new Telegraf(process.env.BOT_TOKEN!);

// Client bot (where customers create orders and receive status updates)
// If CLIENT_BOT_TOKEN is not provided, fallback to specialistBot for backward compatibility
export const clientBot = process.env.CLIENT_BOT_TOKEN 
  ? new Telegraf(process.env.CLIENT_BOT_TOKEN) 
  : specialistBot;

if (!process.env.CLIENT_BOT_TOKEN) {
  console.warn('WARNING: CLIENT_BOT_TOKEN is not defined. Using specialist bot for client notifications.');
}

@Injectable()
export class TelegramService {
  async sendOrderToSpecialist(telegramId: string | number, order: Order) {
    const msg = await specialistBot.telegram.sendMessage(
      telegramId as any,
      `🆕 Новый заказ рядом!
      
📍 ${order.address}
💰 ${order.totalAmount} сом

Нажмите кнопку, чтобы принять:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Принять заказ',
                callback_data: `accept_${order.id}`,
              },
            ],
            [{ text: '❌ Пропустить', callback_data: `skip_${order.id}` }],
          ],
        },
      },
    );

    return msg.message_id;
  }

  async sendMessage(telegramId: string | number, text: string) {
    await clientBot.telegram.sendMessage(telegramId as any, text, { parse_mode: 'HTML' });
  }

  async sendOrderCompletedToClient(telegramId: string | number) {
    await clientBot.telegram.sendMessage(
      telegramId as any,
      `✅ <b>Заказ выполнен!</b>\n\nБлагодарим, что выбрали Город Мастеров — надеемся, мастер оправдал ваши ожидания 😊\n\nПрекрасного настроения и хорошего дня! <b>Город Мастеров</b> всегда рядом 🏠`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔧 Заказать снова', web_app: { url: process.env.CLIENT_MINI_APP_URL! } },
          ]],
        },
      },
    );
  }

  async sendToSpecialist(telegramId: string | number, text: string) {
    await specialistBot.telegram.sendMessage(telegramId as any, text, { parse_mode: 'HTML' });
  }

  async sendUnbanNotification(telegramId: string | number) {
    await specialistBot.telegram.sendMessage(
      telegramId as any,
      `🎉 <b>Ваш аккаунт разблокирован!</b>\n\nВы снова можете принимать заказы. Нажмите кнопку ниже, чтобы выйти на смену.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback('🟢 Я на смене', 'go_on_shift'),
        ]),
      }
    );
  }

  async sendBanNotification(telegramId: string | number) {
    await specialistBot.telegram.sendMessage(
      telegramId as any,
      `❌ <b>Ваш аккаунт заблокирован.</b>\n\nВы больше не можете пользоваться ботом. Если вы считаете, что это ошибка, свяжитесь с поддержкой.`,
      {
        parse_mode: 'HTML',
        ...Markup.removeKeyboard(),
      }
    );
  }
}
