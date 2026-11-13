import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { PuzzleScheduleOrigin } from '@pipou/shared';
import { DailyPuzzle } from './daily-puzzle.entity';

/** Défi affiché un jour donné (choix manuel ou repli automatique figé). */
@Entity('daily_puzzle_schedule')
@Unique('uq_puzzle_schedule_date', ['date'])
export class DailyPuzzleSchedule {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Jour au format 'YYYY-MM-DD' : varchar pour éviter toute conversion de fuseau. */
  @Column({ type: 'varchar', length: 10 })
  date!: string;

  @Column({ type: 'int' })
  puzzleId!: number;

  @ManyToOne(() => DailyPuzzle, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'puzzle_id',
    foreignKeyConstraintName: 'fk_puzzle_schedule_puzzle',
  })
  puzzle!: DailyPuzzle;

  @Column({ type: 'varchar', length: 8 })
  origin!: PuzzleScheduleOrigin;
}
