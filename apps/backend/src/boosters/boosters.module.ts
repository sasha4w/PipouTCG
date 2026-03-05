import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booster } from './booster.entity';
import { BoosterOpenHistory } from './booster-open-history.entity';
import { BoosterOpenCard } from './booster-open-card.entity';
import { BoostersService } from './boosters.service';
import { BoostersController } from './boosters.controller';
import { Card } from '../cards/card.entity';
import { UsersModule } from '../users/users.module';
import { CardsModule } from '../cards/cards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booster,
      BoosterOpenHistory,
      BoosterOpenCard,
      Card,
    ]),
    UsersModule,
    CardsModule,
  ],
  providers: [BoostersService],
  controllers: [BoostersController],
  exports: [BoostersService],
})
export class BoostersModule {}
