import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Card } from '../cards/card.entity';
import { FightsModule } from '../fights/fights.module';
import { UsersModule } from '../users/users.module';
import { DailyPuzzle } from './daily-puzzle.entity';
import { DailyPuzzleSchedule } from './daily-puzzle-schedule.entity';
import { UserPuzzleSolve } from './user-puzzle-solve.entity';
import { PuzzlesController } from './puzzles.controller';
import { PuzzlesService } from './puzzles.service';
import { PuzzleSessionService } from './puzzle-session.service';
import { PuzzleGateway } from './puzzle.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyPuzzle,
      DailyPuzzleSchedule,
      UserPuzzleSolve,
      Card,
    ]),
    FightsModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [PuzzlesService, PuzzleSessionService, PuzzleGateway],
  controllers: [PuzzlesController],
  exports: [PuzzlesService],
})
export class PuzzlesModule {}
