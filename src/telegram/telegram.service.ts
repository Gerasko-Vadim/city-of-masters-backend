import { Order } from 'src/order/entities/order.entity';
import { Telegraf } from 'telegraf';

export const bot = new Telegraf(process.env.BOT_TOKEN!);

export class TelegramService {
  async sendOrderToSpecialist(telegramId: number, order: Order) {
    const msg = await bot.telegram.sendMessage(
      telegramId,
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
                callback_data: `accept:${order.id}`,
              },
            ],
            [{ text: '❌ Пропустить', callback_data: `skip:${order.id}` }],
          ],
        },
      },
    );

    return msg.message_id;
  }

  async sendMessage(telegramId: number, text: string) {
    await bot.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML' });
  }
}
