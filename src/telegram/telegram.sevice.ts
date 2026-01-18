import { Order } from 'src/order/entities/order.entity';
import { Telegraf } from 'telegraf';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const bot = new Telegraf(process.env.BOT_TOKEN!);

export class TelegramService {
  async sendOrderToSpecialist(telegramId: number, order: Order) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await bot.telegram.sendMessage(
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
                  callback_data: `accept_${order.id}`,
                },
              ],
              [{ text: '❌ Пропустить', callback_data: `skip_${order.id}` }],
            ],
          },
        },
      );
    } catch (error) {
      console.error('Error sending message to specialist:', error);
    }
  }
}
