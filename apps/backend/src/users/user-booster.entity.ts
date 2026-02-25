import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Booster } from '../boosters/booster.entity';

@Entity('user_booster')
export class UserBooster {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.userBoosters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Booster, { eager: true })
  @JoinColumn({ name: 'booster_id' })
  booster: Booster;

  @Column({ default: 1 })
  quantity: number;
}
