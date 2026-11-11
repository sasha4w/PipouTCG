import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TUTORIAL_HOOKS } from '../fights/tutorial';
import { UsersModule } from '../users/users.module';
import { TutorialController } from './tutorial.controller';
import { TutorialService } from './tutorial.service';
import { UserTutorialLesson } from './user-tutorial-lesson.entity';

/**
 * Tutoriel jouable. Fournit leçons et récompense à FightsModule (jeton
 * `TUTORIAL_HOOKS`) : FightsModule importe ce module, jamais l'inverse.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserTutorialLesson]), UsersModule],
  controllers: [TutorialController],
  providers: [
    TutorialService,
    { provide: TUTORIAL_HOOKS, useExisting: TutorialService },
  ],
  exports: [TutorialService, TUTORIAL_HOOKS],
})
export class TutorialModule {}
