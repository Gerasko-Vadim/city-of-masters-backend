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
    specialist.location = {
      type: 'Point',
      coordinates: [dto.lng, dto.lat], // ВАЖНО: lng, lat
    };

    return this.repo.save(specialist);
  }
}
