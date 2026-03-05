import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CardSetsModule } from './card-sets/card-sets.module';
import { CardsModule } from './cards/cards.module';
import { QuestModule } from './quests/quest.module';
import { BoostersModule } from './boosters/boosters.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BundlesModule } from './bundles/bundles.module';
import { CustomNamingStrategy } from './database/naming.strategy';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      namingStrategy: new CustomNamingStrategy(),
    }),

    UsersModule,
    AuthModule,
    CardSetsModule,
    CardsModule,
    QuestModule,
    BoostersModule,
    TransactionsModule,
    BundlesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
