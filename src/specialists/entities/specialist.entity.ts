import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

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
  location: string; // POINT(lng lat)

  @CreateDateColumn()
  createdAt: Date;
}
