import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { CardSet } from './card-set.entity';
import { BoosterOpenCard } from '../boosters/booster-open-card.entity';
@Entity('card')
export class Card {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'rarity' })
  rarity: string;

  @Column({ name: 'level' })
  level: number;
  @OneToMany(() => BoosterOpenCard, (boc) => boc.card)
  boosterOpenCards: BoosterOpenCard[];
  @ManyToOne(() => CardSet, (cardSet) => cardSet.cards)
  @JoinColumn({ name: 'id_set' }) // correspond à la FK dans ta DB
  cardSet: CardSet;
}
