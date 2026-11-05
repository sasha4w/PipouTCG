import type { Archetype } from '@pipou/shared';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StarterDeckCard } from './starter-deck-card.entity';

/** Deck de départ d'un archétype (un seul par archétype). */
@Entity('starter_deck')
@Index('UQ_starter_deck_archetype', ['archetype'], { unique: true })
export class StarterDeck {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20 })
  archetype!: Archetype;

  @OneToMany(() => StarterDeckCard, (c) => c.starterDeck)
  cards!: StarterDeckCard[];
}
