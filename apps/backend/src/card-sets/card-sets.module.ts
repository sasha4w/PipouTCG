import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardSetsController } from './card-sets.controller';
import { CardSetsService } from './card-sets.service';
import { CardSet } from './card-set.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CardSet])],
  controllers: [CardSetsController],
  providers: [CardSetsService],
  exports: [CardSetsService],
})
export class CardSetsModule {}
