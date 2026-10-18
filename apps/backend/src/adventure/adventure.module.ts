import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdventureWorld } from './entities/adventure-world.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureOpponentCard } from './entities/adventure-opponent-card.entity';
import { AdventureMatch } from './entities/adventure-match.entity';
import { AdventureSettings } from './entities/adventure-settings.entity';
import { AdventureSeeder } from './adventure.seeder';
import { Card } from '../cards/card.entity';
import { CardSet } from '../card-sets/card-set.entity';
import { Booster } from '../boosters/booster.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdventureWorld,
      AdventureOpponent,
      AdventureOpponentCard,
      AdventureMatch,
      AdventureSettings,
      Card,
      CardSet,
      Booster,
    ]),
  ],
  providers: [AdventureSeeder],
})
export class AdventureModule {}
