import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { CardSet } from '../card-sets/card-set.entity';
import { BoosterOpenCard } from '../boosters/booster-open-card.entity';
import { UserCard } from '../users/user-card.entity';
import { Type } from './enums/type.enum';
import { Rarity } from './enums/rarity.enum';

@Entity('card')
export class Card {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'name' })
  name: string;

  @Column({
    type: 'enum',
    enum: Rarity,
    name: 'rarity',
  })
  rarity: Rarity;

  @Column({
    type: 'enum',
    enum: Type,
    name: 'type',
  })
  type: Type;

  @Column({ name: 'atk' })
  atk: number;

  @Column({ name: 'hp' })
  hp: number;

  @Column({ name: 'id_set' })
  cardSetId: number;
  // cartes tirées dans des ouvertures de booster
  @OneToMany(() => BoosterOpenCard, (boc) => boc.card)
  boosterOpenCards: BoosterOpenCard[];

  // relation vers le set
  @ManyToOne(() => CardSet, (cardSet) => cardSet.cards)
  @JoinColumn({ name: 'id_set' }) // FK: card.id_set -> card_set.id
  cardSet: CardSet;

  // cartes possédées par les utilisateurs
  @OneToMany(() => UserCard, (userCard) => userCard.card)
  userCards: UserCard[];
}
