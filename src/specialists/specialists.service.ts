import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialist } from './entities/specialist.entity';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RegisterTelegramDto } from './dto/register-telegram.dto';
import { EventsGateway } from 'src/events/events.gateway';
import { TelegramService } from 'src/telegram/telegram.service';

@Injectable()
export class SpecialistsService {
  constructor(
    @InjectRepository(Specialist)
    private readonly repo: Repository<Specialist>,
    private readonly eventsGateway: EventsGateway,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) {}

  async findByTelegramId(telegramId: string | number) {
    return this.repo.findOne({ where: { telegramId: telegramId as any } });
  }

  async findAll() {
    const raw = await this.repo
      .createQueryBuilder('s')
      .leftJoin(
        'chat_message',
        'cm',
        'cm.specialistId = s.telegramId AND cm.isRead = false AND cm.senderType = :sender',
        { sender: 'SPECIALIST' }
      )
      .leftJoin(
        'order',
        'o',
        "o.assignedSpecialistId = s.telegramId AND o.status = 'IN_PROGRESS'"
      )
      .select('s')
      .addSelect('COUNT(DISTINCT cm.id)', 'unreadCount')
      .addSelect('COUNT(DISTINCT o.id)', 'activeOrderCount')
      .groupBy('s.id')
      .orderBy('s.createdAt', 'DESC')
      .getRawAndEntities();

    return raw.entities.map((specialist, index) => ({
      ...specialist,
      unreadCount: parseInt(raw.raw[index].unreadCount || '0', 10),
      hasActiveOrder: parseInt(raw.raw[index].activeOrderCount || '0', 10) > 0,
    }));
  }

  async findOneById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async register(dto: RegisterTelegramDto) {
    let specialist = await this.repo.findOne({
      where: { telegramId: dto.telegramId as any },
    });

    if (specialist) {
        if (specialist.isBanned) {
          throw new ForbiddenException('Specialist is banned');
        }
        specialist.username = dto.username || specialist.username;
        specialist.name = dto.name || specialist.name;
        return this.repo.save(specialist);
    }

    specialist = this.repo.create({
      telegramId: dto.telegramId as any,
      name: dto.name,
      username: dto.username,
    });

    return this.repo.save(specialist);
  }

  async updateLocation(dto: UpdateLocationDto) {
    const specialist = await this.repo.findOneBy({
      telegramId: dto.telegramId as any,
    });

    if (!specialist) throw new NotFoundException();

    if (specialist.isBanned) {
      throw new ForbiddenException('Specialist is banned');
    }

    if (!specialist.isOnShift) {
      specialist.lastShiftStartedAt = new Date();
    }
    specialist.isOnShift = true;
    specialist.lat = dto.lat;
    specialist.lng = dto.lng;
    specialist.lastLocationAt = new Date();

    const saved = await this.repo.save(specialist);
    this.eventsGateway.sendSpecialistUpdate(saved);
    return saved;
  }

  async findOnShift() {
    return this.repo.find({
      where: { isOnShift: true },
      select: ['id', 'name', 'lat', 'lng'],
    });
  }

  async findNearbySpecialists(lat: number, lng: number, radiusKm = 5) {
    return this.repo
      .createQueryBuilder('s')
      .where('s.isOnShift = true')
      .andWhere('s.lat IS NOT NULL AND s.lng IS NOT NULL')
      .andWhere(
        `
      6371 * acos(
        cos(radians(:lat)) * cos(radians(s.lat)) *
        cos(radians(s.lng) - radians(:lng)) +
        sin(radians(:lat)) * sin(radians(s.lat))
      ) < :radius
    `,
        { lat, lng, radius: radiusKm },
      )
      .getMany();
  }

  async setOffline(telegramId: string | number) {
    const specialist = await this.repo.findOneBy({ telegramId: telegramId as any });

    if (!specialist) {
      throw new NotFoundException('Specialist not found');
    }

    if (specialist.isBanned) {
      throw new ForbiddenException('Specialist is banned');
    }

    specialist.isOnShift = false;
    // specialist.lat = null;
    // specialist.lng = null;

    const saved = await this.repo.save(specialist);
    this.eventsGateway.sendSpecialistUpdate(saved);
    return saved;
  }

  async setBan(id: number, isBanned: boolean) {
    const specialist = await this.repo.findOneBy({ id });
    if (!specialist) {
      throw new NotFoundException('Specialist not found');
    }
    specialist.isBanned = isBanned;
    if (isBanned) {
      specialist.isOnShift = false;
    }
    const saved = await this.repo.save(specialist);
    this.eventsGateway.sendSpecialistUpdate(saved);

    if (isBanned && saved.telegramId) {
      await this.telegramService.sendBanNotification(saved.telegramId);
    } else if (!isBanned && saved.telegramId) {
      await this.telegramService.sendUnbanNotification(saved.telegramId);
    }

    return saved;
  }

  async broadcast(text: string, filter: 'ALL' | 'ON_SHIFT' | 'OFF_SHIFT') {
    const query = this.repo.createQueryBuilder('s').where('s.isBanned = false');

    if (filter === 'ON_SHIFT') {
      query.andWhere('s.isOnShift = true');
    } else if (filter === 'OFF_SHIFT') {
      query.andWhere('s.isOnShift = false');
    }

    const specialists = await query.getMany();
    let sentCount = 0;

    for (const spec of specialists) {
      if (spec.telegramId) {
        try {
          await this.telegramService.sendToSpecialist(spec.telegramId, text);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send broadcast to ${spec.telegramId}:`, error.message);
        }
      }
    }

    return { sentCount, total: specialists.length };
  }
}

