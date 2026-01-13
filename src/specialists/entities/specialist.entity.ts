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

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lng: number;

  @CreateDateColumn()
  createdAt: Date;
}
