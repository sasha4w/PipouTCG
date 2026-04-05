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
  id!: number; // Ajout du ! ici

  // --- RELATIONS UTILISATEURS ---
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer!: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  // --- RELATIONS OBJETS (READ-ONLY) ---
  @ManyToOne(() => Card, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'product_id' })
  card!: Card;

  @ManyToOne(() => Booster, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'product_id' })
  booster!: Booster;

  @ManyToOne(() => Bundle, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'product_id' })
  bundle!: Bundle;

  // --- COLONNES DE DONNÉES ---

  @Column({ name: 'product_type', type: 'enum', enum: ProductType })
  productType!: ProductType;

  @Column({ name: 'product_id' })
  productId!: number;

  @Column()
  quantity!: number;

  // Attention : bigint en DB est renvoyé en string par JS
  @Column({ name: 'unit_price', type: 'bigint' })
  unitPrice!: number;

  @Column({ name: 'total_price', type: 'bigint' })
  totalPrice!: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
