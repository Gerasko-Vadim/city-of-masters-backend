import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Specialist } from '../../specialists/entities/specialist.entity';

export enum MessageSender {
  SPECIALIST = 'SPECIALIST',
  OPERATOR = 'OPERATOR',
}

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  orderId: number;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'bigint', nullable: true })
  specialistId: number;

  @ManyToOne(() => Specialist, { nullable: true })
  @JoinColumn({ name: 'specialistId', referencedColumnName: 'telegramId' })
  specialist: Specialist;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'enum', enum: MessageSender })
  senderType: MessageSender;

  @Column({ nullable: true })
  senderId: number; // For operators, this will be the operator ID

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
