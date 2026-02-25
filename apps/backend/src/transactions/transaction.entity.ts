import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ProductType } from './enums/product-type.enum';
import { TransactionStatus } from './enums/transaction-status.enum';

@Entity('transaction')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  // Acheteur (null tant que PENDING)
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User | null;

  // Vendeur
  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

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
}
