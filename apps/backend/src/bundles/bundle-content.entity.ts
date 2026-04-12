import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  Index,
  JoinColumn,
} from 'typeorm';
import { Bundle } from './bundle.entity';
import { Card } from '../cards/card.entity';
import { Booster } from '../boosters/booster.entity';

@Entity('bundle_content')
@Index(['bundle', 'card'])
@Index(['bundle', 'booster'])
export class BundleContent {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Bundle, (bundle) => bundle.contents)
  @JoinColumn({ name: 'bundle_id' })
  bundle!: Bundle;

  @ManyToOne(() => Card, { nullable: true })
  @JoinColumn({ name: 'card_id' })
  card!: Card;

  @ManyToOne(() => Booster, { nullable: true })
  @JoinColumn({ name: 'booster_id' })
  booster!: Booster;

  @Column({ default: 1 })
  quantity!: number;
}
