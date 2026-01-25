import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('transaction_log')
export class TransactionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column()
  type: string; // achat, tirage, etc.

  @Column({ type: 'datetime' })
  createdAt: Date;
}
