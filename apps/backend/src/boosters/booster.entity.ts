import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BoosterOpenHistory } from './booster-open-history.entity';
import { CardSet } from '../card-sets/card-set.entity';
import { CardNumber } from './enums/cardnumber.enum';
@Entity('booster')
export class Booster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: CardNumber })
  cardNumber: CardNumber;

  @ManyToOne(() => CardSet)
  @JoinColumn({ name: 'card_set_id' })
  cardSet: CardSet;

  @Column({ type: 'int' })
  price: number;

  @OneToMany(() => BoosterOpenHistory, (boh) => boh.booster)
  openHistories: BoosterOpenHistory[];
}
