import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserCard } from './user-card.entity';
import { UserBooster } from './user-booster.entity';
import { UserBundle } from './user-bundle.entity';
import { UserQuest } from './user-quest.entity';
import { BoosterOpenHistory } from '../boosters/booster-open-history.entity';
import { Transaction } from '../transactions/transaction.entity';

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

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  resetTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  resetTokenExpiry: Date | null;

  // =========================
  // 🔒 PRIVACY
  // =========================
  @Column({ default: false })
  isPrivate: boolean;

  // =========================
  // 💰 ECONOMIE
  // =========================
  @Column({ type: 'bigint', default: 0 })
  gold: number;

  @Column({ type: 'bigint', default: 0 })
  moneySpent: number;

  @Column({ type: 'bigint', default: 0 })
  moneyEarned: number;

  // =========================
  // 📦 ACHATS
  // =========================
  @Column({ default: 0 })
  cardsBought: number;

  @Column({ default: 0 })
  boostersBought: number;

  @Column({ default: 0 })
  bundlesBought: number;

  // =========================
  // 🏪 VENTES
  // =========================
  @Column({ default: 0 })
  cardsSold: number;

  @Column({ default: 0 })
  boostersSold: number;

  @Column({ default: 0 })
  bundlesSold: number;

  // =========================
  // 🎮 PROGRESSION
  // =========================
  @Column({ default: 0 })
  experience: number;

  @Column({ default: 0 })
  boostersOpened: number;

  @Column({ default: 0 })
  setsCompleted: number;

  // =========================
  // 🔗 RELATIONS
  // =========================
  @OneToMany(() => UserCard, (userCard) => userCard.user)
  userCards: UserCard[];

  @OneToMany(() => UserBooster, (ub) => ub.user)
  userBoosters: UserBooster[];

  @OneToMany(() => UserBundle, (ub) => ub.user)
  userBundles: UserBundle[];

  @OneToMany(() => UserQuest, (uq) => uq.user)
  userQuests: UserQuest[];

  @OneToMany(() => BoosterOpenHistory, (boh) => boh.user)
  boosterOpenHistories: BoosterOpenHistory[];

  @OneToMany(() => Transaction, (transaction) => transaction.buyer)
  purchases: Transaction[];

  @OneToMany(() => Transaction, (transaction) => transaction.seller)
  sales: Transaction[];
}
