import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { Quest } from './quest.entity';
import { UserQuest } from '../users/user-quest.entity';
import { UsersModule } from '../users/users.module'; // ← ajouté

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, UserQuest]), // ← que ce dont QuestService a besoin directement
    UsersModule, // ← donne accès à UsersService
  ],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
