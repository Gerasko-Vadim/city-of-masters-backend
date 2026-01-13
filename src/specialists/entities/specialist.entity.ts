import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Point } from 'geojson';

// specialists.entity.ts
@Entity('specialists')
export class Specialist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegramId: number;

  @Column({ nullable: true })
  name: string;

  @Column({ default: false })
  isOnShift: boolean;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: Point;

  @CreateDateColumn()
  createdAt: Date;
}
