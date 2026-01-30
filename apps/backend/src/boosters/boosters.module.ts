import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booster } from './booster.entity';
import { BoosterOpenHistory } from './booster-open-history.entity';
import { BoosterOpenCard } from './booster-open-card.entity';
import { BoostersService } from './boosters.service';
import { BoostersController } from './boosters.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booster, BoosterOpenHistory, BoosterOpenCard]),
  ],
  providers: [BoostersService],
  controllers: [BoostersController],
  exports: [BoostersService],
})
export class BoostersModule {}
