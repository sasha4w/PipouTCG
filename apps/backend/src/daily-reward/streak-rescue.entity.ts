import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('streak_rescue')
export class StreakRescue {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @Column()
  userId!: number;

  @Column()
  daysMissed!: number;

  @Column()
  goldSpent!: number;

  @Column()
  streakBefore!: number;

  @Column()
  streakAfter!: number;

  @CreateDateColumn()
  rescuedAt!: Date;
}
