import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { DeckCard } from './deck-card.entity';

// Types, index et contraintes alignés sur le schéma de production (table créée
// en SQL) : toute différence ferait supprimer/recréer colonnes et index par TypeORM.
@Entity('deck')
export class Deck {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 60 })
  name!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_deck_user' })
  user!: User;

  @Index('idx_deck_user_id')
  @Column({ name: 'user_id' })
  userId!: number;

  @OneToMany(() => DeckCard, (dc) => dc.deck, { cascade: true, eager: true })
  deckCards!: DeckCard[];

  @CreateDateColumn({
    type: 'timestamp',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
