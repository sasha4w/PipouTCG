import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { Bundle } from './bundle.entity';
import { Card } from '../cards/card.entity';
import { Booster } from '../boosters/booster.entity';

@Entity('bundle_content')
export class BundleContent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Bundle, (bundle) => bundle.contents)
  bundle: Bundle;

  @ManyToOne(() => Card, { nullable: true })
  card: Card;

  @Column({ default: 1 })
  quantity: number;

  @ManyToOne(() => Booster, { nullable: true })
  booster: Booster;
}
