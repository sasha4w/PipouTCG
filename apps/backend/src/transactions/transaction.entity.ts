import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Card } from '../cards/card.entity';
import { Booster } from '../boosters/booster.entity';
import { Bundle } from '../bundles/bundle.entity';
import { ProductType } from './enums/product-type.enum';
import { TransactionStatus } from './enums/transaction-status.enum';

@Entity('transaction')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  // --- RELATIONS UTILISATEURS ---

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  // --- RELATIONS OBJETS (POLYMORPHES) ---

  @ManyToOne(() => Card, { nullable: true })
  @JoinColumn({ name: 'productId', referencedColumnName: 'id' })
  card: Card;

  @ManyToOne(() => Booster, { nullable: true })
  @JoinColumn({ name: 'productId', referencedColumnName: 'id' })
  booster: Booster;

  @ManyToOne(() => Bundle, { nullable: true })
  @JoinColumn({ name: 'productId', referencedColumnName: 'id' })
  bundle: Bundle;

  // --- COLONNES DE DONNÉES ---

  @Column({
    type: 'enum',
    enum: ProductType,
  })
  productType: ProductType;

  @Column()
  productId: number;

  @Column()
  quantity: number;

  @Column({ type: 'bigint' })
  unitPrice: number;

  @Column({ type: 'bigint' })
  totalPrice: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
