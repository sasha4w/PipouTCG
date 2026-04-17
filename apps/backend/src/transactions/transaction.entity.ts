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
import { ProductType } from './enums/product-type.enum';
import { TransactionStatus } from './enums/transaction-status.enum';

@Entity('transaction')
export class Transaction {
  @PrimaryGeneratedColumn()
  id!: number;

  // --- RELATIONS UTILISATEURS ---
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer!: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  // --- COLONNES DE DONNÉES ---
  @Column({ name: 'product_type', type: 'enum', enum: ProductType })
  productType!: ProductType;

  @Column({ name: 'product_id' })
  productId!: number;

  @Column({ name: 'item_name', nullable: true })
  itemName!: string;

  @Column()
  quantity!: number;

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
