import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { RewardType } from './enums/reward-type.enum';

@Entity('login_reward_history')
export class LoginRewardHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @Column()
  userId!: number;

  /** Numéro du jour total au moment du claim */
  @Column()
  dayNumber!: number;

  /** Position dans le cycle 7j */
  @Column()
  cycleDay!: number;

  @Column({ type: 'enum', enum: RewardType })
  rewardType!: RewardType;

  @Column()
  rewardValue!: number;

  @Column({ default: 1 })
  quantity!: number;

  /** true si le jour a été racheté en gold (streak rescue) */
  @Column({ default: false })
  wasPurchased!: boolean;

  /** true si c'est une récompense milestone */
  @Column({ default: false })
  isMilestone!: boolean;

  @CreateDateColumn()
  claimedAt!: Date;
}
