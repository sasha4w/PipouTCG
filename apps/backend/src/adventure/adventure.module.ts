import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdventureWorld } from './entities/adventure-world.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureOpponentCard } from './entities/adventure-opponent-card.entity';
import { AdventureMatch } from './entities/adventure-match.entity';
import { AdventureSettings } from './entities/adventure-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdventureWorld,
      AdventureOpponent,
      AdventureOpponentCard,
      AdventureMatch,
      AdventureSettings,
    ]),
  ],
})
export class AdventureModule {}
