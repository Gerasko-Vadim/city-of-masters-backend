import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { RegisterClientDto } from './dto/register-client.dto';
import { clientBot } from 'src/telegram/telegram.service';

const MINI_APP_URL = process.env.CLIENT_MINI_APP_URL || 'https://t.me/city_of_masters_client_bot';

@Injectable()
export class ClientsService implements OnModuleInit {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  // ── Weekly broadcast state ─────────────────────────────────────────────────
  private broadcastEnabled = true;
  private lastSentAt: Date | null = null;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduledBroadcasts = new Map<string, { text: string; scheduledAt: Date; timer: ReturnType<typeof setTimeout> }>();
  private autoText =
    `👋 Привет! На связи команда <b>Город Мастеров</b> 🏠\n\n` +
    `Мы заботимся о вас и хотим убедиться, что всё в порядке.\n\n` +
    `Нужна ли вам помощь мастера? Мы готовы помочь в любой момент!`;

  onModuleInit() {
    this.scheduleNextBroadcast();
  }

  getNextBroadcastAt(): Date {
    const BSK = 6 * 60 * 60 * 1000;
    const now = new Date();
    const bskNow = new Date(now.getTime() + BSK);
    const dow = bskNow.getUTCDay(); // 0=Sun 6=Sat
    const bskHour = bskNow.getUTCHours();

    // If today is Saturday and before 09:00 BSK → next broadcast is today
    const daysUntil = (dow === 6 && bskHour < 9) ? 0 : (6 + 7 - dow) % 7 || 7;

    return new Date(Date.UTC(
      bskNow.getUTCFullYear(),
      bskNow.getUTCMonth(),
      bskNow.getUTCDate() + daysUntil,
      9 - 6, 0, 0, // 09:00 BSK = 03:00 UTC
    ));
  }

  private scheduleNextBroadcast() {
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
    if (!this.broadcastEnabled) return;

    const next = this.getNextBroadcastAt();
    const delay = next.getTime() - Date.now();

    this.broadcastTimer = setTimeout(async () => {
      if (this.broadcastEnabled) await this.sendWeeklyBroadcast();
      this.scheduleNextBroadcast();
    }, delay);
  }

  getAutoText() { return { text: this.autoText }; }
  setAutoText(text: string) { this.autoText = text; return { text: this.autoText }; }

  async sendWeeklyBroadcast(customText?: string) {
    const clients = await this.clientRepository.find({ select: ['telegramId'] });
    const text = customText || this.autoText;

    let sent = 0;
    for (const client of clients) {
      try {
        await clientBot.telegram.sendMessage(client.telegramId as any, text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔧 Заказать мастера', url: MINI_APP_URL }]],
          },
        });
        sent++;
      } catch { /* user may have blocked bot */ }
    }
    this.lastSentAt = new Date();
    console.log(`Weekly client broadcast sent to ${sent}/${clients.length}`);
    return { sent, total: clients.length };
  }

  getBroadcastStatus() {
    return {
      enabled: this.broadcastEnabled,
      nextAt: this.getNextBroadcastAt().toISOString(),
      lastSentAt: this.lastSentAt?.toISOString() ?? null,
    };
  }

  toggleBroadcast() {
    this.broadcastEnabled = !this.broadcastEnabled;
    if (this.broadcastEnabled) {
      this.scheduleNextBroadcast();
    } else if (this.broadcastTimer) {
      clearTimeout(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    return this.getBroadcastStatus();
  }

  // ── Scheduled broadcasts ───────────────────────────────────────────────────

  scheduleCustomBroadcast(text: string, scheduledAt: Date) {
    const delay = scheduledAt.getTime() - Date.now();
    if (delay <= 0) throw new Error('Дата должна быть в будущем');
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const timer = setTimeout(async () => {
      await this.sendWeeklyBroadcast(text);
      this.scheduledBroadcasts.delete(id);
    }, delay);
    this.scheduledBroadcasts.set(id, { text, scheduledAt, timer });
    return { id, scheduledAt: scheduledAt.toISOString(), text };
  }

  getScheduledBroadcasts() {
    return Array.from(this.scheduledBroadcasts.entries()).map(([id, s]) => ({
      id,
      text: s.text,
      scheduledAt: s.scheduledAt.toISOString(),
    }));
  }

  cancelScheduledBroadcast(id: string) {
    const s = this.scheduledBroadcasts.get(id);
    if (s) { clearTimeout(s.timer); this.scheduledBroadcasts.delete(id); }
    return { ok: true };
  }

  // ── Existing methods ───────────────────────────────────────────────────────

  async findByTelegramId(telegramId: string) {
    return this.clientRepository.findOne({ where: { telegramId } });
  }

  async register(dto: RegisterClientDto) {
    let client = await this.findByTelegramId(dto.telegramId);

    const firstName = dto.firstName || dto.name;

    if (client) {
      client.firstName = firstName || client.firstName;
      client.lastName = dto.lastName || client.lastName;
      client.username = dto.username || client.username;
      client.phone = dto.phone || client.phone;
      return this.clientRepository.save(client);
    }

    client = this.clientRepository.create({ ...dto, firstName });
    return this.clientRepository.save(client);
  }

  async findOne(id: number) {
    return this.clientRepository.findOne({ where: { id }, relations: ['orders'] });
  }

  async findAll() {
    const clients = await this.clientRepository.find({
      relations: ['orders', 'chatMessages'],
      order: { createdAt: 'DESC' },
    });

    return clients.map((client) => {
      const hasNewOrder = client.orders.some((o) => o.status === 'NEW');
      const unreadCount = client.chatMessages.filter(
        (m) => !m.isRead && m.senderType === 'CLIENT',
      ).length;

      return {
        ...client,
        hasNewOrder,
        unreadCount,
        orders: undefined,
        chatMessages: undefined,
      };
    });
  }
}
