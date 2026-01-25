import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { BoosterOpenHistory } from './booster-open-history.entity';
@Entity('booster')
export class Booster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  rarity: string;

  @OneToMany(() => BoosterOpenHistory, (boh) => boh.booster)
  openHistories: BoosterOpenHistory[];
}
