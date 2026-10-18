import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestController } from './quests.controller';
import { QuestService } from './quests.service';
import { Quest } from './quest.entity';
import { UserQuest } from '../users/user-quest.entity';
import { User } from '../users/user.entity';
import { QuestPoolSeeder } from './quest-pool.seeder';
import { UsersModule } from '../users/users.module'; // ← ajouté

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, UserQuest, User]), // ← que ce dont QuestService a besoin directement
    UsersModule, // ← donne accès à UsersService
  ],
  controllers: [QuestController],
  providers: [QuestService, QuestPoolSeeder],
  exports: [QuestService],
})
export class QuestModule {}
