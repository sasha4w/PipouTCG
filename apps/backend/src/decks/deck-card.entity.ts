import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Deck } from './deck.entity';
import { Card } from '../cards/card.entity';

@Entity('deck_card')
export class DeckCard {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Deck, (deck) => deck.deckCards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck!: Deck;

  @Column({ name: 'deck_id' })
  deckId!: number;

  @ManyToOne(() => Card, { eager: true })
  @JoinColumn({ name: 'card_id' })
  card!: Card;

  @Column({ name: 'card_id' })
  cardId!: number;

  @Column({ default: 1 })
  quantity!: number;
}
