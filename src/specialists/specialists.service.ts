import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialist } from './entities/specialist.entity';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RegisterTelegramDto } from './dto/register-telegram.dto';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class SpecialistsService {
  constructor(
    @InjectRepository(Specialist)
    private readonly repo: Repository<Specialist>,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findByTelegramId(telegramId: number) {
    return this.repo.findOne({ where: { telegramId } });
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
      .select('s')
      .addSelect('COUNT(cm.id)', 'unreadCount')
      .groupBy('s.id')
      .orderBy('s.createdAt', 'DESC')
      .getRawAndEntities();

    return raw.entities.map((specialist, index) => ({
      ...specialist,
      unreadCount: parseInt(raw.raw[index].unreadCount || '0', 10),
    }));
  }

  async findOneById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async register(dto: RegisterTelegramDto) {
    let specialist = await this.repo.findOne({
      where: { telegramId: dto.telegramId },
    });

    if (specialist) {
        specialist.username = dto.username || specialist.username;
        specialist.name = dto.name || specialist.name;
        return this.repo.save(specialist);
    }

    specialist = this.repo.create({
      telegramId: dto.telegramId,
      name: dto.name,
      username: dto.username,
    });

    return this.repo.save(specialist);
  }

  async updateLocation(dto: UpdateLocationDto) {
    const specialist = await this.repo.findOneBy({
      telegramId: dto.telegramId,
    });

    if (!specialist) throw new NotFoundException();

    if (!specialist.isOnShift) {
      specialist.lastShiftStartedAt = new Date();
    }
    specialist.isOnShift = true;
    specialist.lat = dto.lat;
    specialist.lng = dto.lng;

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
      earth_distance(
        ll_to_earth(:lat, :lng),
        ll_to_earth(s.lat, s.lng)
      ) < :radius
    `,
        { lat, lng, radius: radiusKm * 1000 },
      )
      .getMany();
  }

  async setOffline(telegramId: number) {
    const specialist = await this.repo.findOneBy({ telegramId });

    if (!specialist) {
      throw new NotFoundException('Specialist not found');
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
    return saved;
  }
}

