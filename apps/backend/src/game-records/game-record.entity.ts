import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type {
  GameRecordMode,
  GameRecordSummary,
  MatchEndReason,
  Seat,
} from '@pipou/shared';

/**
 * Partie terminée, JcJ ou PvE : résumé interrogeable (méta) et trace brotli
 * coup par coup (apprentissage de l'IA). Pas de clé étrangère vers `user` :
 * la ligne survit à la suppression d'un compte.
 */
@Entity('game_record')
export class GameRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'match_id', type: 'int' })
  matchId!: number;

  @Index('idx_game_record_mode')
  @Column({ type: 'varchar', length: 8 })
  mode!: GameRecordMode;

  @Column({ name: 'player1_id', type: 'int' })
  player1Id!: number;

  @Column({ name: 'player2_id', type: 'int', nullable: true })
  player2Id!: number | null;

  @Column({ name: 'winner_seat', type: 'varchar', length: 4, nullable: true })
  winnerSeat!: Seat | null;

  @Column({ name: 'end_reason', type: 'varchar', length: 32, nullable: true })
  endReason!: MatchEndReason | null;

  @Column({ type: 'int' })
  turns!: number;

  @Column({ type: 'int' })
  moves!: number;

  @Column({ type: 'json' })
  summary!: GameRecordSummary;

  /** NDJSON brotli ; null si la trace a été abandonnée (plafonds). Jamais lu par les listes. */
  @Column({ type: 'longblob', nullable: true, select: false })
  trace!: Buffer | null;

  @Column({ name: 'trace_bytes', type: 'int' })
  traceBytes!: number;

  @Column({ name: 'format_version', type: 'smallint' })
  formatVersion!: number;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;

  @Index('idx_game_record_ended')
  @Column({ name: 'ended_at', type: 'datetime' })
  endedAt!: Date;
}
