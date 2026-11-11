import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  TUTORIAL_LESSONS,
  TUTORIAL_REWARD,
  type TutorialLessonId,
  type TutorialOverview,
  type TutorialResultPayload,
} from '@pipou/shared';
import { Card } from '../cards/card.entity';
import type { TutorialHooks, TutorialStart } from '../fights/tutorial';
import { UsersService } from '../users/users.service';
import { buildLessonGame, cardResolver } from './lesson-board';
import { LessonRunner } from './lesson-runner';
import { lessonCardNames } from './lesson.types';
import { LESSONS } from './lessons';
import { UserTutorialLesson } from './user-tutorial-lesson.entity';

/** Décalage des identifiants de partie de leçon, loin des combats d'Aventure. */
const TUTORIAL_MATCH_OFFSET = 1_000_000_000;

@Injectable()
export class TutorialService implements TutorialHooks {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}

  async getOverview(userId: number): Promise<TutorialOverview> {
    const done = await this.dataSource.manager.find(UserTutorialLesson, {
      where: { userId },
    });
    const completed = new Set(done.map((d) => d.lessonId));
    return {
      lessons: TUTORIAL_LESSONS.map((id) => ({
        id,
        completed: completed.has(id),
      })),
      reward: { ...TUTORIAL_REWARD },
    };
  }

  async prepare(
    userId: number,
    username: string,
    lessonId: TutorialLessonId,
  ): Promise<TutorialStart> {
    const lesson = LESSONS[lessonId];
    if (!lesson) throw new BadRequestException('Leçon introuvable');
    const cards = await this.dataSource.manager.find(Card);
    const matchId = -(TUTORIAL_MATCH_OFFSET + userId);
    // Une carte renommée ou retirée casse la leçon : refus net plutôt qu'un plateau bancal
    const resolve = cardResolver(cards);
    for (const name of lessonCardNames(lesson)) resolve(name);
    const game = buildLessonGame(lesson, resolve, {
      matchId,
      userId,
      username,
      opponentId: matchId,
      opponentName: 'Maître Pipou',
    });
    return { lessonId, game, runner: new LessonRunner(lesson) };
  }

  /**
   * Fin de leçon. La récompense n'est versée qu'à la première réussite : la
   * ligne est insérée sous l'index unique `(user_id, lesson_id)`, et seule
   * l'insertion qui aboutit paie.
   */
  async recordResult(
    userId: number,
    lessonId: TutorialLessonId,
    completed: boolean,
  ): Promise<TutorialResultPayload> {
    const none = {
      lessonId,
      completed,
      firstCompletion: false,
      gold: 0,
      xp: 0,
    };
    if (!completed) return none;
    return this.dataSource.transaction(async (m) => {
      const res = await m
        .createQueryBuilder()
        .insert()
        .into(UserTutorialLesson)
        .values({ userId, lessonId })
        .orIgnore()
        // Insertion ignorée = aucun id généré à recopier : sans cela TypeORM lève
        .updateEntity(false)
        .execute();
      const inserted =
        (res.raw as { affectedRows?: number } | undefined)?.affectedRows === 1;
      if (!inserted) return none;
      await this.users.addGold(userId, TUTORIAL_REWARD.gold, m);
      await this.users.addExperience(userId, TUTORIAL_REWARD.xp, m);
      return {
        ...none,
        firstCompletion: true,
        gold: TUTORIAL_REWARD.gold,
        xp: TUTORIAL_REWARD.xp,
      };
    });
  }
}
