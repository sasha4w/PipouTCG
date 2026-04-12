import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Card } from '../cards/card.entity';

@Entity('image')
export class Image {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  url!: string;

  @Column()
  deleteUrl!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Card, (card) => card.image)
  cards!: Card[];
}
