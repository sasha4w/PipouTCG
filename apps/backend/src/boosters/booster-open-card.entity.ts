import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  Index,
} from 'typeorm';
import { Card } from '../cards/card.entity';
import { BoosterOpenHistory } from './booster-open-history.entity';

@Entity('booster_open_card')
@Index(['openHistory', 'card'], { unique: true })
export class BoosterOpenCard {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ManyToOne(() => Card, (card) => card.boosterOpenCards)
  @JoinColumn({ name: 'card_id' })
  card: Card;

  @ManyToOne(() => BoosterOpenHistory, (history) => history.openCards)
  @JoinColumn({ name: 'open_history_id' })
  openHistory: BoosterOpenHistory;

  @Column({ default: 1 })
  quantity: number;
}
