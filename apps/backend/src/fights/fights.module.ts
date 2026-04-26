import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Match } from './entities/match.entity';
import { PlayerStats } from './entities/player-stats.entity';
import { DecksModule } from '../decks/decks.module';

// Gateway / Controller
import { FightsGateway } from './fights.gateway';
import { FightsController } from './fights.controller';

// Orchestrator
import { FightsService } from './fights.service';

// Sub-services
import { MatchmakingService } from './services/matchmaking.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { PhaseService } from './services/phase.service';
import { SummonService } from './services/summon.service';
import { SupportService } from './services/support.service';
import { BattleService } from './services/battle.service';
import { PickService } from './services/pick.service';
import { GameEndService } from './services/game-end.service';
import { TurnTimeoutService } from './services/turn-timeout.service';

// Shared engine services
import { EffectsResolverService } from './effects-resolver.service';
import { BuffsCalculatorService } from './buffs-calculator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, PlayerStats]),
    DecksModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [FightsController],
  providers: [
    // Orchestrator
    FightsService,

    // Sub-services
    MatchmakingService,
    DeckSubmissionService,
    PhaseService,
    SummonService,
    SupportService,
    BattleService,
    PickService,
    GameEndService,
    TurnTimeoutService,

    // Engine
    EffectsResolverService,
    BuffsCalculatorService,

    // Gateway
    FightsGateway,
  ],
})
export class FightsModule {}
