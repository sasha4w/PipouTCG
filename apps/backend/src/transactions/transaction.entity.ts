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
  @JoinColumn({ name: 'buyer_id' }) // MySQL: buyer_id
  buyer: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' }) // MySQL: seller_id
  seller: User;

  // --- RELATIONS OBJETS (READ-ONLY) ---
  // On utilise 'product_id' car c'est le nom physique dans ta table MySQL
  @ManyToOne(() => Card, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'product_id' })
  card: Card;

  @ManyToOne(() => Booster, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'product_id' })
  booster: Booster;

  @ManyToOne(() => Bundle, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'product_id' })
  bundle: Bundle;

  // --- COLONNES DE DONNÉES ---

  @Column({ name: 'product_type', type: 'enum', enum: ProductType })
  productType: ProductType;

  @Column({ name: 'product_id' }) // On force le nom product_id ici
  productId: number;

  @Column()
  quantity: number;

  @Column({ name: 'unit_price', type: 'bigint' })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'bigint' })
  totalPrice: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
