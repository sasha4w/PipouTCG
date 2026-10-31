import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  AiOutcome,
  AiProblemCategory,
  AiVerdict,
  GameAction,
} from '@pipou/shared';

/** Avis d'un admin sur une décision de l'IA : un exemple à analyser, pas une vérité. */
@Entity('ai_annotation')
export class AiAnnotation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('idx_ai_annotation_decision')
  @Column({ name: 'decision_id', type: 'varchar', length: 96 })
  decisionId!: string;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Column({ type: 'varchar', length: 24 })
  verdict!: AiVerdict;

  @Column({ type: 'json', nullable: true })
  preferred!: GameAction | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  category!: AiProblemCategory | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  outcome!: AiOutcome | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
