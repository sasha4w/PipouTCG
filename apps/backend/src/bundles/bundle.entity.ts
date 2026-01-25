import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { BundleContent } from './bundle-content.entity';

@Entity('bundle')
export class Bundle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => BundleContent, (content) => content.bundle)
  contents: BundleContent[];
}
