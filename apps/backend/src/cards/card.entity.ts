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
import { Image } from '../images/image.entity';
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

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => Image, (image) => image.cards, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'image_id' })
  image: Image; // ← relation au lieu de imageUrl string

  @ManyToOne(() => CardSet, (cardSet) => cardSet.cards)
  @JoinColumn({ name: 'card_set_id' })
  cardSet: CardSet;

  @OneToMany(() => BoosterOpenCard, (boc) => boc.card)
  boosterOpenCards: BoosterOpenCard[];

  @OneToMany(() => UserCard, (userCard) => userCard.card)
  userCards: UserCard[];
}
