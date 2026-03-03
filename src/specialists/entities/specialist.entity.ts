import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// specialists.entity.ts
@Entity('specialists')
@Index(['lat', 'lng']) // Composite index for geospatial queries
@Index(['isOnShift']) // Index for filtering active specialists
export class Specialist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, type: 'bigint', nullable: true })
  telegramId: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: false })
  isOnShift: boolean;

  @Column({ type: 'float', nullable: true })
  lat: number | null;

  @Column({ type: 'float', nullable: true })
  lng: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastShiftStartedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLocationAt: Date | null;

  @Column({ default: false })
  isBanned: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
