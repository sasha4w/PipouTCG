import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RewardType } from './enums/reward-type.enum';

/**
 * Définit les récompenses du cycle 7j.
 * week_number = NULL → s'applique à toutes les semaines.
 * week_number = 2    → s'applique uniquement à la semaine 2+.
 * L'admin peut surcharger avec un label spécial (ex: Saint-Valentin).
 */
@Entity('daily_reward_definition')
export class DailyRewardDefinition {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Jour dans le cycle (1-7) */
  @Column()
  cycleDay!: number;

  /** NULL = toutes les semaines, sinon à partir de cette semaine */
  @Column({ nullable: true, type: 'int' })
  weekNumber!: number | null;

  @Column({ type: 'enum', enum: RewardType })
  rewardType!: RewardType;

  /** Quantité de gold OU id de la carte/booster/bundle selon rewardType */
  @Column()
  rewardValue!: number;

  @Column({ default: 1 })
  quantity!: number;

  /** Label optionnel pour événements spéciaux (ex: "🌹 Spécial Saint-Valentin") */
  @Column({ type: 'varchar', length: 255, nullable: true })
  label!: string | null;

  /** Actif ou non (permet de désactiver sans supprimer) */
  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
