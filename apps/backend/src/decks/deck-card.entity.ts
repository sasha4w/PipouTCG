import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Deck } from './deck.entity';
import { UserCard } from '../users/user-card.entity';

// Types, index et contraintes alignés sur le schéma de production (table créée
// en SQL) : toute différence ferait supprimer/recréer colonnes et index par TypeORM.
@Entity('deck_card')
@Index('uq_deck_card', ['deckId', 'userCardId'], { unique: true })
export class DeckCard {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Deck, (deck) => deck.deckCards, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'deck_id',
    foreignKeyConstraintName: 'fk_deck_card_deck',
  })
  deck!: Deck;

  @Index('idx_deck_card_deck_id')
  @Column({ name: 'deck_id' })
  deckId!: number;

  // On pointe vers UserCard, pas Card directement
  @ManyToOne(() => UserCard, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_card_id',
    foreignKeyConstraintName: 'fk_deck_card_user_card',
  })
  userCard!: UserCard;

  @Index('idx_deck_card_card_id')
  @Column({ name: 'user_card_id' })
  userCardId!: number;

  @Column({ type: 'tinyint', default: 1 })
  quantity!: number;
}
