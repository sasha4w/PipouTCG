import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('player_stats')
export class PlayerStats {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id', unique: true })
  userId!: number;

  @Column({ default: 0 })
  wins!: number;

  @Column({ default: 0 })
  losses!: number;

  @Column({ default: 0 })
  draws!: number;

  /** ELO rating — starts at 1000. */
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
