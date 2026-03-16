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
import { CardType } from './enums/cardtype.enum';
import { Rarity } from './enums/rarity.enum';
import { SupportType } from './enums/support-type.enum';
import { CardEffect } from './interfaces/card-effect.interface';
import { Archetype } from './enums/archetype.enum';
@Entity('card')
export class Card {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: Rarity })
  rarity: Rarity;

  @Column({ type: 'enum', enum: CardType })
  type: CardType;

  @Column({ default: 0 })
  atk: number;

  @Column({ default: 0 })
  hp: number;

  // ── Nouveau ──────────────────────────────────────────────────

  @Column({ default: 0 })
  cost: number;

  @Column({
    type: 'enum',
    enum: SupportType,
    nullable: true,
    default: null,
  })
  supportType: SupportType | null;

  @Column({
    type: 'enum',
    enum: Archetype,
    nullable: true,
    default: null,
  })
  archetype: Archetype | null;

  @Column({ type: 'json', nullable: true, default: null })
  effects: CardEffect[] | null;

  // ─────────────────────────────────────────────────────────────

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => Image, (image) => image.cards, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'image_id' })
  image: Image | null;

  @ManyToOne(() => CardSet, (cardSet) => cardSet.cards)
  @JoinColumn({ name: 'card_set_id' })
  cardSet: CardSet;

  @OneToMany(() => BoosterOpenCard, (boc) => boc.card)
  boosterOpenCards: BoosterOpenCard[];

  @OneToMany(() => UserCard, (userCard) => userCard.card)
  userCards: UserCard[];
}
