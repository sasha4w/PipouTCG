import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserCard } from './user-card.entity';
import { BoosterOpenHistory } from '../boosters/booster-open-history.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: false })
  is_admin: boolean;

  // ===== PROGRESSION =====

  @Column({ default: 0 })
  experience: number;

  @Column({ default: 0 })
  gold: number;

  // ===== STATS =====

  @Column({ default: 0 })
  boostersOpened: number;

  @Column({ default: 0 })
  cardsBought: number;

  @Column({ default: 0 })
  cardsSold: number;

  @Column({ default: 0 })
  moneyEarned: number;

  @Column({ default: 0 })
  setsCompleted: number;

  @OneToMany(() => UserCard, (userCard) => userCard.user)
  userCards: UserCard[];

  @OneToMany(() => BoosterOpenHistory, (boh) => boh.user)
  boosterOpenHistories: BoosterOpenHistory[];
}
