import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialist } from './entities/specialist.entity';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RegisterTelegramDto } from './dto/register-telegram.dto';

@Injectable()
export class SpecialistsService {
  constructor(
    @InjectRepository(Specialist)
    private readonly repo: Repository<Specialist>,
  ) {}

  async findByTelegramId(telegramId: number) {
    return this.repo.findOne({ where: { telegramId } });
  }

  async register(dto: RegisterTelegramDto) {
    let specialist = await this.repo.findOne({
      where: { telegramId: dto.telegramId },
    });

    if (specialist) return specialist;

    specialist = this.repo.create({
      telegramId: dto.telegramId,
      name: dto.name,
    });

    return this.repo.save(specialist);
  }

  async updateLocation(dto: UpdateLocationDto) {
    const specialist = await this.repo.findOneBy({
      telegramId: dto.telegramId,
    });

    if (!specialist) throw new NotFoundException();

    specialist.isOnShift = true;
    specialist.lat = dto.lat;
    specialist.lng = dto.lng;

    return this.repo.save(specialist);
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
    specialist.lat = null;
    specialist.lng = null;

    return this.repo.save(specialist);
  }
}

