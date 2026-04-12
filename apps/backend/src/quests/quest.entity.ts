import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import {
  QuestResetType,
  RewardType,
  ConditionOperator,
} from './enums/quest.enums';
import { UserQuest } from '../users/user-quest.entity';

export interface QuestCondition {
  type: string;
  amount?: number;
  rarity?: string;
  setId?: number;
  boosterId?: number;
  level?: number;
}

export interface QuestConditionGroup {
  operator: ConditionOperator;
  conditions: QuestCondition[];
}

@Entity('quest')
export class Quest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ nullable: true })
  description!: string;

  // Type de reset
  @Column({ type: 'enum', enum: QuestResetType, default: QuestResetType.NONE })
  resetType!: QuestResetType;

  // Heure du reset (ex: 4 = 4h00 du matin)
  @Column({ default: 4 })
  resetHour!: number;

  // Jour de la semaine pour WEEKLY (0=dimanche, 1=lundi... 6=samedi)
  @Column({ nullable: true })
  resetDayOfWeek!: number;

  // Conditions en JSON
  @Column({ type: 'json' })
  conditionGroup!: QuestConditionGroup;

  // Récompense
  @Column({ type: 'enum', enum: RewardType })
  rewardType!: RewardType;

  @Column({ type: 'bigint', default: 0 })
  rewardAmount!: number;

  @Column({ nullable: true })
  rewardItemId!: number; // boosterId ou bundleId

  @Column({ type: 'timestamp', nullable: true })
  endDate!: Date | null;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => UserQuest, (uq) => uq.quest)
  userQuests!: UserQuest[];
}
