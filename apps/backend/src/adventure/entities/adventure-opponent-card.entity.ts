import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Card } from '../../cards/card.entity';
import { AdventureOpponent } from './adventure-opponent.entity';

/** Carte (et quantité) du deck d'un adversaire. */
@Entity('adventure_opponent_card')
@Index('UQ_adventure_opponent_card', ['opponentId', 'cardId'], {
  unique: true,
})
export class AdventureOpponentCard {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => AdventureOpponent, (o) => o.cards, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'opponent_id',
    foreignKeyConstraintName: 'FK_adventure_opp_card_opponent',
  })
  opponent!: AdventureOpponent;

  @Column({ name: 'opponent_id' })
  opponentId!: number;

  @ManyToOne(() => Card, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'card_id',
    foreignKeyConstraintName: 'FK_adventure_opp_card_card',
  })
  card!: Card;

  @Column({ name: 'card_id' })
  cardId!: number;

  @Column({ type: 'int', default: 1 })
  quantity!: number;
}
