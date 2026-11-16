import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PuzzleStatus } from '@pipou/shared';
import type { PuzzleObjectiveType } from '@pipou/shared';
import type { SerializedGame } from '../sandbox/scenario-serializer';
import { User } from '../users/user.entity';

/** Défi du jour : situation de départ figée, objectif et récompense. */
@Entity('daily_puzzle')
export class DailyPuzzle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80 })
  title!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  /** État de départ sérialisé (scenario-serializer). */
  @Column({ type: 'json' })
  state!: SerializedGame;

  @Column({ type: 'varchar', length: 24 })
  objectiveType!: PuzzleObjectiveType;

  @Column({ type: 'json' })
  objectiveParams!: { targetInstanceId?: string; primes?: number };

  @Column({ type: 'int' })
  seed!: number;

  @Column({ type: 'int', default: 100 })
  rewardGold!: number;

  @Column({ type: 'int', default: 50 })
  rewardXp!: number;

  @Index('idx_daily_puzzle_status')
  @Column({ type: 'varchar', length: 12, default: PuzzleStatus.DRAFT })
  status!: PuzzleStatus;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt!: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'created_by_id',
    foreignKeyConstraintName: 'fk_daily_puzzle_user',
  })
  createdBy!: User | null;

  @CreateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
