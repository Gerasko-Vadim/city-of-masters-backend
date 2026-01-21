import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OrderStatus {
  NEW = 'NEW',
  PAID = 'PAID',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity()
@Index(['status']) // Index for filtering by status
@Index(['lat', 'lng']) // Composite index for geospatial queries
@Index(['status', 'createdAt']) // Composite index for common queries
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customerName: string;

  @Column()
  phone: string;

  @Column()
  address: string;

  @Column({ type: 'decimal' })
  totalAmount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.NEW })
  status: OrderStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

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

  @Column({ type: 'int', nullable: true })
  assignedSpecialistId?: number;

  @Column('jsonb', { default: [] })
  notifiedSpecialists: { telegramId: number; messageId: number }[];
}
