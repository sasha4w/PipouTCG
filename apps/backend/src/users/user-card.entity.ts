import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { User } from './user.entity';
import { Card } from '../cards/card.entity';

@Entity('user_card')
export class UserCard {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.userCards)
  user: User;

  @ManyToOne(() => Card)
  card: Card;

  @Column({ default: 1 })
  quantity: number;
}
