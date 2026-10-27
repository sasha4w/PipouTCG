import type { AchievementFamily } from '@pipou/shared';
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
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ default: false })
  is_admin!: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  resetTokenHash!: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  resetTokenExpiry!: Date | null;

  // =========================
  // 🔒 PRIVACY
  // =========================
  @Column({ default: false })
  isPrivate!: boolean;

  // =========================
  // 💰 ECONOMIE
  // =========================
  @Column({ type: 'bigint', default: 0 })
  gold!: number;

  @Column({ name: 'money_spent', type: 'bigint', default: 0 }) // Ajout du name
  moneySpent!: number;

  @Column({ name: 'money_earned', type: 'bigint', default: 0 }) // Ajout du name
  moneyEarned!: number;

  // =========================
  // 📦 ACHATS
  // =========================
  @Column({ name: 'cards_bought', default: 0 }) // Ajout du name
  cardsBought!: number;

  @Column({ name: 'boosters_bought', default: 0 }) // Ajout du name
  boostersBought!: number;

  @Column({ name: 'bundles_bought', default: 0 }) // Ajout du name
  bundlesBought!: number;

  // =========================
  // 🏪 VENTES
  // =========================
  @Column({ name: 'cards_sold', default: 0 }) // Ajout du name
  cardsSold!: number;

  @Column({ name: 'boosters_sold', default: 0 }) // Ajout du name
  boostersSold!: number;

  // =========================
  // FORGE
  // =========================
  @Column({ type: 'bigint', default: 0 })
  dust!: number;

  @Column({ name: 'dust_earned', type: 'bigint', default: 0 })
  dustEarned!: number;

  @Column({ name: 'cards_forged', default: 0 })
  cardsForged!: number;

  @Column({ name: 'cards_destroyed', default: 0 })
  cardsDestroyed!: number;

  @Column({ name: 'bundles_sold', default: 0 }) // Ajout du name
  bundlesSold!: number;

  // =========================
  // 🎮 PROGRESSION
  // =========================
  @Column({ default: 0 })
  experience!: number;

  @Column({ name: 'boosters_opened', default: 0 }) // Ajout du name
  boostersOpened!: number;

  @Column({ name: 'sets_completed', default: 0 }) // Ajout du name
  setsCompleted!: number;

  @Column({
    name: 'equipped_title',
    type: 'varchar',
    length: 32,
    nullable: true,
    default: null,
  })
  equippedTitle!: AchievementFamily | null;

  @Column({ name: 'quests_completed', default: 0 })
  questsCompleted!: number;

  @Column({
    name: 'last_quest_reroll_at',
    type: 'datetime',
    nullable: true,
    default: null,
  })
  lastQuestRerollAt!: Date | null;

  // =========================
  // 🔗 RELATIONS (Ajoute aussi les !)
  // =========================
  @OneToMany(() => UserCard, (userCard) => userCard.user)
  userCards!: UserCard[];

  @OneToMany(() => UserBooster, (ub) => ub.user)
  userBoosters!: UserBooster[];

  @OneToMany(() => UserBundle, (ub) => ub.user)
  userBundles!: UserBundle[];

  @OneToMany(() => UserQuest, (uq) => uq.user)
  userQuests!: UserQuest[];

  @OneToMany(() => BoosterOpenHistory, (boh) => boh.user)
  boosterOpenHistories!: BoosterOpenHistory[];

  @OneToMany(() => Transaction, (transaction) => transaction.buyer)
  purchases!: Transaction[];

  @OneToMany(() => Transaction, (transaction) => transaction.seller)
  sales!: Transaction[];
}
