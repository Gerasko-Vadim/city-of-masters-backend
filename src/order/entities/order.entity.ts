import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Specialist } from '../../specialists/entities/specialist.entity';
import { Client } from '../../clients/entities/client.entity';

export enum OrderStatus {
  NEW = 'NEW',
  PAID = 'PAID',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum OrderSource {
  CLIENT = 'CLIENT',
  ADMIN = 'ADMIN',
}

@Entity()
@Index(['status']) // Index for filtering by status
@Index(['lat', 'lng']) // Composite index for geospatial queries
@Index(['status', 'createdAt']) // Composite index for common queries
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: OrderSource, default: OrderSource.CLIENT })
  source: OrderSource;

  @Column()
  customerName: string;

  @Column()
  phone: string;

  @Column()
  address: string;

  @Column({ type: 'decimal' })
  totalAmount: number;

  @Column({ type: 'decimal', default: 0 })
  commission: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.NEW })
  status: OrderStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  category?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'float' })
  lat: number;

  @Column({ type: 'float' })
  lng: number;

  @Column({ nullable: true })
  clientId?: number;

  @ManyToOne(() => Client, (client) => client.orders, { nullable: true })
  @JoinColumn({ name: 'clientId' })
  client?: Client;

  @Column({ type: 'bigint', nullable: true })
  assignedSpecialistId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @ManyToOne(() => Specialist, { nullable: true })
  @JoinColumn({ name: 'assignedSpecialistId', referencedColumnName: 'telegramId' })
  assignedSpecialist?: Specialist;

  @Column('jsonb', { default: [] })
  notifiedSpecialists: { telegramId: string; messageId: number }[];

  @Column({ type: 'varchar', nullable: true })
  finikPaymentId?: string;
}
