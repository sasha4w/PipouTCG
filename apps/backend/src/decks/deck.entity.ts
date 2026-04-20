import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { DeckCard } from './deck-card.entity';

@Entity('deck')
export class Deck {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 60 })
  name!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @OneToMany(() => DeckCard, (dc) => dc.deck, { cascade: true, eager: true })
  deckCards!: DeckCard[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
