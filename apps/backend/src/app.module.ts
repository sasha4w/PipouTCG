import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CardSetsModule } from './card-sets/card-sets.module';
import { ImagesModule } from './images/images.module';
import { CardsModule } from './cards/cards.module';
import { QuestModule } from './quests/quests.module';
import { BoostersModule } from './boosters/boosters.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BundlesModule } from './bundles/bundles.module';
import { BannersModule } from './banners/banners.module';
import { ShopModule } from './shop/shop.module';
import { DailyRewardModule } from './daily-reward/daily-reward.module';
import { CustomNamingStrategy } from './database/naming.strategy';
import { validateEnv } from './config/env.validation';
import { Buffer } from 'buffer';
import { EventEmitterModule } from '@nestjs/event-emitter';
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: process.env.NODE_ENV === 'test' ? 0 : 60000,
        limit: process.env.NODE_ENV === 'test' ? 999999 : 100,
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      namingStrategy: new CustomNamingStrategy(),
      ssl: process.env.DB_SSL_CA_BASE64
        ? {
            ca: Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64'),
            rejectUnauthorized: true,
          }
        : undefined,
      extra: {
        connectionLimit: 20,
        connectTimeout: 60000,
        queueLimit: 0,
        waitForConnections: true,
      },
    }),

    UsersModule,
    AuthModule,
    CardSetsModule,
    CardsModule,
    QuestModule,
    BoostersModule,
    TransactionsModule,
    BundlesModule,
    ImagesModule,
    BannersModule,
    ShopModule,
    DailyRewardModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
