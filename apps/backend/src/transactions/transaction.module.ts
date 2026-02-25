import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { UserBundle } from '../users/user-bundle.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserCard } from '../users/user-card.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      User,
      UserCard,
      UserBooster,
      UserBundle,
    ]),
  ],
  providers: [TransactionService],
  controllers: [TransactionController],
})
export class TransactionModule {}
