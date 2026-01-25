import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Card } from '../cards/card.entity';
import { BoosterOpenHistory } from './booster-open-history.entity';

@Entity('booster_open_card')
export class BoosterOpenCard {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  // Clé étrangère vers Card
  @ManyToOne(() => Card, (card) => card.boosterOpenCards)
  @JoinColumn({ name: 'card_id' }) // correspond à fk_booster_open_card_card
  card: Card;

  // Clé étrangère vers BoosterOpenHistory
  @ManyToOne(() => BoosterOpenHistory, (history) => history.openCards)
  @JoinColumn({ name: 'open_history_id' }) // correspond à fk_booster_open_open_history
  openHistory: BoosterOpenHistory;
}
