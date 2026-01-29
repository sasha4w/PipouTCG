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
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: Rarity })
  rarity: Rarity;

  @Column({ type: 'enum', enum: Type })
  type: Type;

  @Column()
  atk: number;

  @Column()
  hp: number;

  @ManyToOne(() => CardSet, (cardSet) => cardSet.cards)
  @JoinColumn({ name: 'card_set_id' })
  cardSet: CardSet;

  @OneToMany(() => BoosterOpenCard, (boc) => boc.card)
  boosterOpenCards: BoosterOpenCard[];

  @OneToMany(() => UserCard, (userCard) => userCard.card)
  userCards: UserCard[];
}
