import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CardSet } from '../../card-sets/card-set.entity';
import { Booster } from '../../boosters/booster.entity';
import { AdventureOpponent } from './adventure-opponent.entity';

/** Monde de l'aventure PvE (un set de cartes, débloqué par ses prérequis). */
@Entity('adventure_world')
export class AdventureWorld {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @ManyToOne(() => CardSet, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'card_set_id',
    foreignKeyConstraintName: 'FK_adventure_world_card_set',
  })
  cardSet!: CardSet;

  @Column({ name: 'card_set_id' })
  cardSetId!: number;

  @ManyToOne(() => Booster, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'booster_id',
    foreignKeyConstraintName: 'FK_adventure_world_booster',
  })
  booster!: Booster | null;

  @Column({ name: 'booster_id', type: 'int', nullable: true, default: null })
  boosterId!: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  order!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @ManyToMany(() => AdventureWorld)
  @JoinTable({
    name: 'adventure_world_prerequisite',
    joinColumn: {
      name: 'world_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_adventure_prereq_world',
    },
    inverseJoinColumn: {
      name: 'required_world_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_adventure_prereq_required',
    },
  })
  prerequisites!: AdventureWorld[];

  @OneToMany(() => AdventureOpponent, (o) => o.world)
  opponents!: AdventureOpponent[];
}
