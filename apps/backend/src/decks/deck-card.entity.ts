import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Deck } from './deck.entity';
import { UserCard } from '../users/user-card.entity';
@Entity('deck_card')
export class DeckCard {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Deck, (deck) => deck.deckCards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck!: Deck;

  @Column({ name: 'deck_id' })
  deckId!: number;

  // On pointe vers UserCard, pas Card directement
  @ManyToOne(() => UserCard, { eager: true })
  @JoinColumn({ name: 'user_card_id' })
  userCard!: UserCard;

  @Column({ name: 'user_card_id' })
  userCardId!: number;

  @Column({ default: 1 })
  quantity!: number;
}
