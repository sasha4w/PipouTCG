import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Défi résolu par un joueur un jour donné (une récompense par jour). */
@Entity('user_puzzle_solve')
@Unique('uq_user_puzzle_day', ['userId', 'date'])
export class UserPuzzleSolve {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_puzzle_solve_user',
  })
  user!: User;

  /** Jour au format 'YYYY-MM-DD'. */
  @Column({ type: 'varchar', length: 10 })
  date!: string;

  @Column({ type: 'int' })
  puzzleId!: number;

  @Column({ type: 'datetime' })
  solvedAt!: Date;
}
