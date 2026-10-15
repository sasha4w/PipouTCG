import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionController } from './transactions.controller';
import { TransactionService } from './transactions.service';
import { TransactionStatsService } from './stats/transaction-stats.service';
import { Transaction } from './transaction.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), UsersModule],
  controllers: [TransactionController],
  providers: [TransactionService, TransactionStatsService],
  exports: [TransactionService],
})
export class TransactionsModule {}
