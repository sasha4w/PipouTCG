import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('login_streak')
export class LoginStreak {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @Column()
  userId!: number;

  @Column({ default: 0 })
  currentStreak!: number;

  @Column({ default: 0 })
  longestStreak!: number;

  /** Dernier jour où la récompense a été réclamée (date only, pas heure) */
  @Column({ type: 'date', nullable: true })
  lastClaimDate!: string | null;
  /** Position dans le cycle 7j (1-7) */
  @Column({ default: 1 })
  cycleDay!: number;

  /** Total jours cumulés all-time */
  @Column({ default: 0 })
  totalDays!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
