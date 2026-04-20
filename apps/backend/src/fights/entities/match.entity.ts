import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

export enum MatchStatus {
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

export enum MatchEndReason {
  PRIMES_DEPLETED = 'primes_depleted',
  DECK_EMPTY = 'deck_empty',
  SURRENDER = 'surrender',
  DISCONNECT = 'disconnect',
}

@Entity('match')
export class Match {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'player1_id' })
  player1!: User;

  @Column({ name: 'player1_id' })
  player1Id!: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'player2_id' })
  player2!: User;

  @Column({ name: 'player2_id' })
  player2Id!: number;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'winner_id' })
  winner!: User | null;

  @Column({ name: 'winner_id', nullable: true })
  winnerId!: number | null;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.IN_PROGRESS })
  status!: MatchStatus;

  @Column({ type: 'enum', enum: MatchEndReason, nullable: true, default: null })
  endReason!: MatchEndReason | null;

  @Column({ default: 0 })
  totalTurns!: number;

  @CreateDateColumn()
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  endedAt!: Date | null;
}
