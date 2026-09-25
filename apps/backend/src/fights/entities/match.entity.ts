import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { MatchEndReason, MatchStatus } from '@pipou/shared';
import { User } from '../../users/user.entity';

// Types, index et contraintes alignés sur le schéma de production (table créée
// en SQL) : toute différence ferait supprimer/recréer colonnes et index par TypeORM.
@Entity('match')
export class Match {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({
    name: 'player1_id',
    foreignKeyConstraintName: 'fk_match_player1',
  })
  player1!: User;

  @Index('idx_match_player1')
  @Column({ name: 'player1_id' })
  player1Id!: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({
    name: 'player2_id',
    foreignKeyConstraintName: 'fk_match_player2',
  })
  player2!: User;

  @Index('idx_match_player2')
  @Column({ name: 'player2_id' })
  player2Id!: number;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({
    name: 'winner_id',
    foreignKeyConstraintName: 'fk_match_winner',
  })
  winner!: User | null;

  @Index('idx_match_winner')
  @Column({ name: 'winner_id', nullable: true })
  winnerId!: number | null;

  @Index('idx_match_status')
  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.IN_PROGRESS })
  status!: MatchStatus;

  @Column({ type: 'enum', enum: MatchEndReason, nullable: true, default: null })
  endReason!: MatchEndReason | null;

  @Column({ default: 0 })
  totalTurns!: number;

  @Index('idx_match_started')
  @CreateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  endedAt!: Date | null;
}
