import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StarterDeck } from './starter-deck.entity';
import { StarterDeckCard } from './starter-deck-card.entity';
import { StarterDecksService } from './starter-decks.service';
import { StarterDecksController } from './starter-decks.controller';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StarterDeck, StarterDeckCard, User]),
    UsersModule,
  ],
  providers: [StarterDecksService],
  controllers: [StarterDecksController],
  exports: [StarterDecksService],
})
export class StarterDecksModule {}
