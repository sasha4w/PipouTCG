import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Card } from '../cards/card.entity';

@Entity('user_card')
export class UserCard {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.userCards)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Card, (card) => card.userCards)
  @JoinColumn({ name: 'card_id' })
  card: Card;

  @Column({ default: 1 })
  quantity: number;
}
