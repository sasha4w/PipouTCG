import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Card } from '../cards/card.entity';

@Entity('card_set')
export class CardSet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Card, (card) => card.cardSet)
  cards: Card[];
}
