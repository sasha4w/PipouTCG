import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type {
  AdventureArchetype,
  AiDecisionSource,
  GameAction,
} from '@pipou/shared';

/**
 * Décision de l'IA journalisée pendant un combat d'un admin (revue).
 * `stateGz` : état complet de la partie avant le coup, JSON compressé (gzip),
 * donnée de débogage qui ne sert jamais à l'IA.
 */
@Entity('ai_decision')
export class AiDecision {
  @PrimaryColumn({ type: 'varchar', length: 96 })
  id!: string;

  @Index('idx_ai_decision_game')
  @Column({ name: 'game_id', type: 'varchar', length: 64 })
  gameId!: string;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Column({ type: 'int' })
  turn!: number;

  @Column({ type: 'varchar', length: 16 })
  phase!: string;

  @Column({ type: 'varchar', length: 4 })
  seat!: 'p1' | 'p2';

  @Column({ type: 'varchar', length: 16 })
  archetype!: AdventureArchetype;

  @Column({ type: 'int' })
  level!: number;

  @Column({ type: 'varchar', length: 16 })
  source!: AiDecisionSource;

  @Column({ type: 'json' })
  chosen!: GameAction;

  @Column({ name: 'chosen_text', type: 'varchar', length: 255 })
  chosenText!: string;

  @Column({ type: 'json' })
  candidates!: { action: GameAction; score: number }[];

  @Column({ type: 'double', nullable: true })
  baseline!: number | null;

  @Column({ type: 'double' })
  regret!: number;

  @Column({ name: 'simulation_crashes', type: 'json' })
  simulationCrashes!: { action: GameAction; message: string }[];

  @Column({ name: 'state_gz', type: 'longblob' })
  stateGz!: Buffer;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
