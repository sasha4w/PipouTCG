import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Booster } from './booster.entity';
import { BoosterOpenCard } from './booster-open-card.entity';

@Entity('booster_open_history')
export class BoosterOpenHistory {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  // Clé étrangère vers User
  @ManyToOne(() => User, (user) => user.boosterOpenHistories)
  @JoinColumn({ name: 'user_id' }) // FK correspondante dans la DB
  user: User;

  // Clé étrangère vers Booster
  @ManyToOne(() => Booster, (booster) => booster.openHistories)
  @JoinColumn({ name: 'booster_id' }) // FK correspondante dans la DB
  booster: Booster;

  @Column({ name: 'opened_at', type: 'datetime' })
  openedAt: Date;

  // Relation vers les cartes ouvertes dans ce booster
  @OneToMany(() => BoosterOpenCard, (boc) => boc.openHistory)
  openCards: BoosterOpenCard[];
}
