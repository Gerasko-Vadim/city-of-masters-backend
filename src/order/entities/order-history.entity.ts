import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('order_history')
@Index(['orderId'])
export class OrderHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column({ type: 'text' })
  event: string;

  @CreateDateColumn()
  createdAt: Date;
}
