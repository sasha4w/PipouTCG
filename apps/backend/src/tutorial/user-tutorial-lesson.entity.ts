import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TutorialLessonId } from '@pipou/shared';
import { User } from '../users/user.entity';

/** Leçon terminée par un joueur : la ligne existe = la récompense a été versée. */
@Entity('user_tutorial_lesson')
@Index('UQ_user_tutorial_lesson', ['userId', 'lessonId'], { unique: true })
export class UserTutorialLesson {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_tutorial_lesson_user',
  })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'lesson_id', type: 'varchar', length: 32 })
  lessonId!: TutorialLessonId;

  @CreateDateColumn({ name: 'completed_at' })
  completedAt!: Date;
}
