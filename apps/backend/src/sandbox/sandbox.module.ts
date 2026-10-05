import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Card } from '../cards/card.entity';
import { FightsModule } from '../fights/fights.module';
import { TurnTimeoutService } from '../fights/services/turn-timeout.service';
import { SandboxScenario } from './sandbox-scenario.entity';
import { SandboxGateway } from './sandbox.gateway';
import { SandboxService } from './sandbox.service';
import { ScenariosService } from './scenarios.service';
import { ScenariosController } from './scenarios.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Card, SandboxScenario]),
    FightsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ScenariosController],
  providers: [
    SandboxService,
    ScenariosService,
    SandboxGateway,
    // Timer propre au sandbox, distinct de celui des matchs classés
    TurnTimeoutService,
  ],
})
export class SandboxModule {}
