import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AchievementTier, type AchievementFamily } from '@pipou/shared';
import { User } from '../users/user.entity';

/** Palier de succès réclamé (la progression, elle, est calculée). */
@Entity('user_achievement')
@Index('UQ_user_achievement_tier', ['userId', 'family', 'tier'], {
  unique: true,
})
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_achievement_user',
  })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 32 })
  family!: AchievementFamily;

  @Column({ type: 'enum', enum: AchievementTier })
  tier!: AchievementTier;

  @CreateDateColumn({ name: 'claimed_at' })
  claimedAt!: Date;
}
