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
  @OneToMany(() => UserCard, (userCard) => userCard.user)
  userCards: UserCard[];
  @OneToMany(() => BoosterOpenHistory, (boh) => boh.user)
  boosterOpenHistories: BoosterOpenHistory[];
}
