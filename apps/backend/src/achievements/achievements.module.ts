import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { UserAchievement } from './user-achievement.entity';
import { AchievementStatsService } from './achievement-stats.service';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserAchievement, User]), UsersModule],
  controllers: [AchievementsController],
  providers: [AchievementStatsService, AchievementsService],
})
export class AchievementsModule {}
