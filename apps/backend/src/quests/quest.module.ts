import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { Quest } from './quest.entity';
import { UserQuest } from '../users/user-quest.entity';
import { User } from '../users/user.entity';
import { UserCard } from '../users/user-card.entity';
import { UserBooster } from '../users/user-booster.entity';
import { UserBundle } from '../users/user-bundle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quest,
      UserQuest,
      User,
      UserCard,
      UserBooster,
      UserBundle,
    ]),
  ],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
