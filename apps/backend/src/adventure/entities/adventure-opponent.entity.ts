import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Card } from '../../cards/card.entity';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { AdventureWorld } from './adventure-world.entity';
import { AdventureOpponentCard } from './adventure-opponent-card.entity';

/** Adversaire IA d'un monde (position 1..5) avec sa récompense. */
@Entity('adventure_opponent')
@Index('UQ_adventure_opponent_position', ['worldId', 'position'], {
  unique: true,
})
export class AdventureOpponent {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => AdventureWorld, (w) => w.opponents, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'world_id',
    foreignKeyConstraintName: 'FK_adventure_opponent_world',
  })
  world!: AdventureWorld;

  @Column({ name: 'world_id' })
  worldId!: number;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  quote!: string;

  @ManyToOne(() => Card, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'portrait_card_id',
    foreignKeyConstraintName: 'FK_adventure_opponent_portrait',
  })
  portraitCard!: Card | null;

  @Column({
    name: 'portrait_card_id',
    type: 'int',
    nullable: true,
    default: null,
  })
  portraitCardId!: number | null;

  @Column({ type: 'varchar', length: 255 })
  signature!: string;

  @Column({ name: 'first_win_gold', type: 'int', default: 0 })
  firstWinGold!: number;

  @Column({ name: 'first_win_xp', type: 'int', default: 0 })
  firstWinXp!: number;

  @Column({ name: 'farm_gold', type: 'int', default: 0 })
  farmGold!: number;

  @Column({ name: 'farm_xp', type: 'int', default: 0 })
  farmXp!: number;

  @Column({
    name: 'farm_booster_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  farmBoosterPct!: number;

  @Column({
    name: 'farm_legendary_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  farmLegendaryPct!: number;

  @OneToMany(() => AdventureOpponentCard, (c) => c.opponent)
  cards!: AdventureOpponentCard[];
}
