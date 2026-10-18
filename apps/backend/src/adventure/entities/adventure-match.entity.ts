import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AdventureLoot } from '@pipou/shared';
import { User } from '../../users/user.entity';
import { AdventureOpponent } from './adventure-opponent.entity';

/** Combat contre une IA (won = null tant qu'il est en cours). */
@Entity('adventure_match')
@Index('idx_adventure_match_user_opponent', ['userId', 'opponentId'])
@Index('idx_adventure_match_user_ended', ['userId', 'endedAt'])
export class AdventureMatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_adventure_match_user',
  })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => AdventureOpponent, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'opponent_id',
    foreignKeyConstraintName: 'FK_adventure_match_opponent',
  })
  opponent!: AdventureOpponent;

  @Column({ name: 'opponent_id' })
  opponentId!: number;

  @Column({ type: 'tinyint', width: 1, nullable: true, default: null })
  won!: boolean | null;

  @Column({ name: 'first_win', type: 'tinyint', width: 1, default: 0 })
  firstWin!: boolean;

  @Column({
    name: 'end_reason',
    type: 'varchar',
    length: 32,
    nullable: true,
    default: null,
  })
  endReason!: string | null;

  @Column({ type: 'int', default: 0 })
  turns!: number;

  @Column({ type: 'json', nullable: true })
  loot!: AdventureLoot | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  rewarded!: boolean;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true, default: null })
  endedAt!: Date | null;
}
