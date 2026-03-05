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
    const maskedPhone = order.phone ? order.phone.slice(0, -3) + '***' : '';

    // Extract upper price bound from "Стоимость: 400–600 сом" → "600 сом"
    const priceMatch = order.description?.match(/Стоимость:\s*(.+)/);
    let priceDisplay = '';
    if (priceMatch) {
      const numbers = priceMatch[1].match(/\d+/g);
      priceDisplay = numbers?.length ? `${numbers[numbers.length - 1]} сом` : priceMatch[1].trim();
    }

    // Description without the Стоимость line
    const desc = (order.description ?? '')
      .split('\n')
      .filter(line => !line.startsWith('Стоимость:'))
      .join('\n')
      .trim();

    const typeLine = order.category ? `🔧 Тип работы: ${order.category}\n` : '';
    const priceLine = priceDisplay ? `💰 Стоимость от: ${priceDisplay}\n` : '';
    const descLine = desc ? `📋 Описание: ${desc}\n` : '';
    const phoneLine = maskedPhone ? `📞 ${maskedPhone}\n` : '';

    const text =
      `⚡️ <b>Новый заказ рядом!</b>\n` +
      `─────────────────\n` +
      `${typeLine}` +
      `📍 ${order.address}\n` +
      `${priceLine}` +
      `${descLine}` +
      `${phoneLine}` +
      `─────────────────\n` +
      `Нажмите кнопку, чтобы принять:`;

    const msg = await specialistBot.telegram.sendMessage(
      telegramId as any,
      text,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Принять', callback_data: `accept_${order.id}` },
              { text: '❌ Пропустить', callback_data: `skip_${order.id}` },
            ],
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
    const miniAppUrl = process.env.CLIENT_MINI_APP_URL;
    await clientBot.telegram.sendMessage(
      telegramId as any,
      `🎉 <b>Готово! Ваш заказ выполнен.</b>\n\nСпасибо, что доверились нам — это очень важно для нас ❤️\n\nПомните: какая бы задача ни возникла дома — мы уже здесь. <b>Город Мастеров</b> всегда рядом с вами 🏠\n\nОтличного настроения и до новых встреч! 👋`,
      {
        parse_mode: 'HTML',
        ...(miniAppUrl ? {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔧 Заказать снова', web_app: { url: miniAppUrl } },
            ]],
          },
        } : {}),
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
