import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RewardType } from './enums/reward-type.enum';

/** Récompenses déclenchées aux paliers J30, J60, J100... */
@Entity('milestone_reward')
export class MilestoneReward {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Palier en jours (30, 60, 100, 180, 365...) */
  @Column({ type: 'int', unique: true })
  dayThreshold!: number;

  @Column({ type: 'enum', enum: RewardType })
  rewardType!: RewardType;

  @Column({ type: 'int' }) // Explicite
  rewardValue!: number;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
