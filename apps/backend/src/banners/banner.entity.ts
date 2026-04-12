import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum BannerItemType {
  BOOSTER = 'BOOSTER',
  BUNDLE = 'BUNDLE',
}

@Entity('banner')
export class Banner {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ nullable: true })
  imageUrl!: string;

  @Column({ type: 'enum', enum: BannerItemType })
  itemType!: BannerItemType;

  @Column()
  itemId!: number;

  @Column()
  itemName!: string;

  @Column({ type: 'int' })
  originalPrice!: number;

  @Column({ type: 'int' })
  bannerPrice!: number;

  @Column({ type: 'timestamp' })
  startDate!: Date;

  @Column({ type: 'timestamp' })
  endDate!: Date;

  @Column({ default: true })
  isActive!: boolean;
}
