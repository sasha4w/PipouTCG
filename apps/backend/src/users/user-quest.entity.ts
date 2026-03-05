import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Quest } from '../quests/quest.entity';

export interface ConditionProgress {
  type: string;
  current: number;
  target: number;
  completed: boolean;
  rarity?: string;
  setId?: number;
  boosterId?: number;
}

export interface QuestProgress {
  operator: string;
  conditions: ConditionProgress[];
  globalCompleted: boolean;
}

@Entity('user_quest')
export class UserQuest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.userQuests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Quest, (q) => q.userQuests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quest_id' })
  quest: Quest;

  // Progression détaillée par condition
  @Column({ type: 'json' })
  progress: QuestProgress;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ default: false })
  rewardClaimed: boolean;

  @CreateDateColumn()
  assignedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  resetAt: Date | null;
}
