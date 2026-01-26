import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Order } from './order.entity';

export enum MessageSender {
  SPECIALIST = 'SPECIALIST',
  OPERATOR = 'OPERATOR',
}

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne(() => Order)
  order: Order;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'enum', enum: MessageSender })
  senderType: MessageSender;

  @Column({ nullable: true })
  senderId: number; // For operators, this will be the operator ID

  @CreateDateColumn()
  createdAt: Date;
}
