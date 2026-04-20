import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deck } from './deck.entity';
import { DeckCard } from './deck-card.entity';
import { Card } from '../cards/card.entity';
import { UserCard } from '../users/user-card.entity';

import { DecksService } from './decks.service';
import { DecksController } from './decks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Deck, DeckCard, Card, UserCard])],
  controllers: [DecksController],
  providers: [DecksService],
  exports: [DecksService],
})
export class DecksModule {}
