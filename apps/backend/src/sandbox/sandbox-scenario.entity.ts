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
import { User } from '../users/user.entity';

/** Scénario de sandbox sauvegardé, partagé entre tous les admins. */
@Entity('sandbox_scenario')
export class SandboxScenario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  description!: string | null;

  /** Partie sérialisée (cartes réduites à leur id), voir scenario-serializer. */
  @Column({ type: 'json' })
  state!: Record<string, unknown>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'created_by_id',
    foreignKeyConstraintName: 'fk_sandbox_scenario_user',
  })
  createdBy!: User;

  @Index('idx_sandbox_scenario_created_by')
  @Column({ name: 'created_by_id' })
  createdById!: number;

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
