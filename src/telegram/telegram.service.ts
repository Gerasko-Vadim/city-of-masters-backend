import { Injectable } from '@nestjs/common';
import { Order } from 'src/order/entities/order.entity';
import { Telegraf, Markup } from 'telegraf';

export const bot = new Telegraf(process.env.BOT_TOKEN!);

@Injectable()
export class TelegramService {
  async sendOrderToSpecialist(telegramId: string | number, order: Order) {
    const msg = await bot.telegram.sendMessage(
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
    await bot.telegram.sendMessage(telegramId as any, text, { parse_mode: 'HTML' });
  }

  async sendUnbanNotification(telegramId: string | number) {
    await bot.telegram.sendMessage(
      telegramId as any,
      `🎉 <b>Ваш аккаунт разблокирован!</b>\n\nВы снова можете принимать заказы. Нажмите кнопку ниже, чтобы выйти на смену.`,
      {
        parse_mode: 'HTML',
        ...Markup.keyboard([['🟢 Я на смене']]).resize().oneTime(),
      }
    );
  }
}
