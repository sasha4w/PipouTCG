import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Card } from '../cards/card.entity';
import { StarterDeck } from './starter-deck.entity';

/** Carte (quantité, mise en avant) d'un starter deck. */
@Entity('starter_deck_card')
@Index('UQ_starter_deck_card', ['starterDeckId', 'cardId'], { unique: true })
export class StarterDeckCard {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => StarterDeck, (d) => d.cards, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'starter_deck_id',
    foreignKeyConstraintName: 'FK_starter_deck_card_deck',
  })
  starterDeck!: StarterDeck;

  @Column({ name: 'starter_deck_id' })
  starterDeckId!: number;

  @ManyToOne(() => Card, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'card_id',
    foreignKeyConstraintName: 'FK_starter_deck_card_card',
  })
  card!: Card;

  @Column({ name: 'card_id' })
  cardId!: number;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ name: 'is_featured', default: false })
  isFeatured!: boolean;
}
