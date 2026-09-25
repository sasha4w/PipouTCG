import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

// Noms alignés sur le schéma de production (table créée en SQL) :
// toute différence ferait supprimer/recréer index et contraintes par TypeORM.
@Entity('player_stats')
export class PlayerStats {
  @PrimaryGeneratedColumn()
  id!: number;

  // Un seul PlayerStats par joueur, garanti par l'index unique uq_player_stats_user
  // (un @OneToOne imposerait son propre index REL_…).
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_player_stats_user',
  })
  user!: User;

  @Index('uq_player_stats_user', { unique: true })
  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ default: 0 })
  wins!: number;

  @Column({ default: 0 })
  losses!: number;

  @Column({ default: 0 })
  draws!: number;

  /** ELO rating — starts at 1000. */
  @Index('idx_player_stats_elo')
  @Column({ default: 1000 })
  elo!: number;

  get totalGames(): number {
    return this.wins + this.losses + this.draws;
  }

  get winRate(): number {
    const total = this.totalGames;
    return total === 0 ? 0 : Math.round((this.wins / total) * 100);
  }
}
