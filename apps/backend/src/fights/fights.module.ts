import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Match } from './entities/match.entity';
import { PlayerStats } from './entities/player-stats.entity';
import { FightsService } from './fights.service';
import { FightsGateway } from './fights.gateway';
import { FightsController } from './fights.controller';
import { EffectsResolverService } from './effects-resolver.service';
import { BuffsCalculatorService } from './buffs-calculator.service';
import { DecksModule } from '../decks/decks.module';

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
    FightsService,
    FightsGateway,
    EffectsResolverService,
    BuffsCalculatorService,
  ],
})
export class FightsModule {}
