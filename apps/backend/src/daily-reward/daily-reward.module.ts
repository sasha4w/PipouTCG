import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginStreak } from './login-streak.entity';
import { DailyRewardDefinition } from './daily-reward-definition.entity';
import { MilestoneReward } from './milestone-reward.entity';
import { LoginRewardHistory } from './login-reward-histority.entity';
import { StreakRescue } from './streak-rescue.entity';
import { DailyRewardService } from './daily-reward.service';
import { DailyRewardController } from './daily-reward.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoginStreak,
      DailyRewardDefinition,
      MilestoneReward,
      LoginRewardHistory,
      StreakRescue,
    ]),
    UsersModule,
  ],
  providers: [DailyRewardService],
  controllers: [DailyRewardController],
  exports: [DailyRewardService],
})
export class DailyRewardModule {}
