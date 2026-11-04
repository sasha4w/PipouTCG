import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Card } from '../cards/card.entity';

@Entity('user_card')
@Index(['user', 'card'], { unique: true })
export class UserCard {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.userCards)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Card, (card) => card.userCards)
  @JoinColumn({ name: 'card_id' })
  card!: Card;

  @Column({ default: 1 })
  quantity!: number;

  /** Copies protégées de la destruction, de la forge et de la vente. */
  @Column({ name: 'locked_quantity', default: 0 })
  lockedQuantity!: number;
}
