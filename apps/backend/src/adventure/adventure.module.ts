import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdventureWorld } from './entities/adventure-world.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureOpponentCard } from './entities/adventure-opponent-card.entity';
import { AdventureMatch } from './entities/adventure-match.entity';
import { AdventureSettings } from './entities/adventure-settings.entity';
import { AdventureSeeder } from './adventure.seeder';
import { AdventureService } from './adventure.service';
import { AdventureController } from './adventure.controller';
import { AdventureAdminController } from './adventure-admin.controller';
import { AdventureAdminService } from './adventure-admin.service';
import { Card } from '../cards/card.entity';
import { CardSet } from '../card-sets/card-set.entity';
import { Booster } from '../boosters/booster.entity';
import { UsersModule } from '../users/users.module';
import { PVE_HOOKS } from '../fights/pve';

/**
 * Mode Aventure. Fournit la persistance PvE à FightsModule (jeton
 * `PVE_HOOKS`) : FightsModule importe ce module, jamais l'inverse.
 */
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
    UsersModule,
  ],
  controllers: [AdventureController, AdventureAdminController],
  providers: [
    AdventureSeeder,
    AdventureService,
    AdventureAdminService,
    { provide: PVE_HOOKS, useExisting: AdventureService },
  ],
  exports: [AdventureService, PVE_HOOKS],
})
export class AdventureModule {}
