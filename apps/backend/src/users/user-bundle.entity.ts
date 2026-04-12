import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Bundle } from '../bundles/bundle.entity';

@Entity('user_bundle')
@Index(['user', 'bundle'], { unique: true })
export class UserBundle {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.userBundles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Bundle, { eager: true })
  @JoinColumn({ name: 'bundle_id' })
  bundle!: Bundle;

  @Column({ default: 1 })
  quantity!: number;
}
