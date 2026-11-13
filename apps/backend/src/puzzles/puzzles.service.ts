import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In, Repository } from 'typeorm';
import {
  ACHIEVEMENT_REWARD_BOOSTER_ID,
  PuzzleScheduleOrigin,
  PuzzleStatus,
} from '@pipou/shared';
import type {
  DailyPuzzleInfo,
  PuzzleObjective,
  PuzzleObjectiveView,
  PuzzleReward,
  PuzzleStreak,
} from '@pipou/shared';
import { Card } from '../cards/card.entity';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { nextDailyReset } from '../quests/quest-schedule';
import {
  collectCardIds,
  deserializeGame,
} from '../sandbox/scenario-serializer';
import { UsersService } from '../users/users.service';
import { DailyPuzzle } from './daily-puzzle.entity';
import { DailyPuzzleSchedule } from './daily-puzzle-schedule.entity';
import { UserPuzzleSolve } from './user-puzzle-solve.entity';
import { pickFallback, puzzleDay } from './puzzle-schedule';
import { computeStreak, earnsBooster } from './puzzle-streak';

export interface LoadedPuzzle {
  puzzle: DailyPuzzle;
  objective: PuzzleObjective;
  game: GameState;
}

@Injectable()
export class PuzzlesService {
  constructor(
    @InjectRepository(DailyPuzzle)
    private readonly puzzles: Repository<DailyPuzzle>,
    @InjectRepository(DailyPuzzleSchedule)
    private readonly schedule: Repository<DailyPuzzleSchedule>,
    @InjectRepository(UserPuzzleSolve)
    private readonly solves: Repository<UserPuzzleSolve>,
    @InjectRepository(Card) private readonly cards: Repository<Card>,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  /** Défi du jour ; sans programmation, le repli est inscrit pour que tous voient le même. */
  async today(
    now = new Date(),
  ): Promise<{ date: string; puzzle: DailyPuzzle | null }> {
    const date = puzzleDay(now);
    const planned = await this.schedule.findOne({
      where: { date },
      relations: { puzzle: true },
    });
    if (planned) {
      // Un défi programmé mais dépublié ou non vérifié n'est pas jouable ; la ligne du
      // jour existe déjà (unicité par date), le repli ne peut donc pas la remplacer.
      const playable =
        planned.puzzle.status === PuzzleStatus.PUBLISHED &&
        planned.puzzle.verifiedAt != null;
      return { date, puzzle: playable ? planned.puzzle : null };
    }

    const rows = await this.dataSource.query<
      { id: number; lastPlayed: string | null }[]
    >(
      `SELECT p.id AS id, MAX(s.date) AS lastPlayed
         FROM daily_puzzle p LEFT JOIN daily_puzzle_schedule s ON s.puzzle_id = p.id
        WHERE p.status = ? AND p.verified_at IS NOT NULL
        GROUP BY p.id`,
      [PuzzleStatus.PUBLISHED],
    );
    const id = pickFallback(
      rows.map((r) => ({ id: Number(r.id), lastPlayed: r.lastPlayed })),
    );
    if (id === null) return { date, puzzle: null };
    // orIgnore : deux premiers accès simultanés n'inscrivent qu'une ligne
    await this.schedule
      .createQueryBuilder()
      .insert()
      .values({ date, puzzleId: id, origin: PuzzleScheduleOrigin.AUTO })
      .orIgnore()
      .execute();
    const row = await this.schedule.findOne({
      where: { date },
      relations: { puzzle: true },
    });
    return { date, puzzle: row?.puzzle ?? null };
  }

  async streakOf(userId: number, today: string): Promise<PuzzleStreak> {
    const rows = await this.solves.find({
      where: { userId },
      select: ['date'],
    });
    return computeStreak(
      rows.map((r) => r.date),
      today,
    );
  }

  /** Le nom de la cible vient des cartes : sans `game` chargé, il reste absent. */
  objectiveView(puzzle: DailyPuzzle, game?: GameState): PuzzleObjectiveView {
    const objective: PuzzleObjectiveView = {
      type: puzzle.objectiveType,
      ...puzzle.objectiveParams,
    };
    if (objective.targetInstanceId && game) {
      const target = game.player2.monsterZones.find(
        (m) => m?.instanceId === objective.targetInstanceId,
      );
      if (target) objective.targetName = target.card.baseCard.name;
    }
    return objective;
  }

  async getToday(userId: number): Promise<DailyPuzzleInfo> {
    const now = new Date();
    const { date, puzzle } = await this.today(now);
    const [solved, streak] = await Promise.all([
      this.solves.exists({ where: { userId, date } }),
      this.streakOf(userId, date),
    ]);
    // Le nom de la cible n'est pas dans l'état sérialisé : on recharge les cartes
    let game: GameState | undefined;
    if (puzzle?.objectiveParams.targetInstanceId) {
      try {
        game = (await this.load(puzzle.id, { userId, username: '' })).game;
      } catch {
        // Carte supprimée depuis l'enregistrement : le défi reste affiché sans nom de cible.
        game = undefined;
      }
    }
    return {
      date,
      puzzle: puzzle && {
        id: puzzle.id,
        title: puzzle.title,
        description: puzzle.description,
        objective: this.objectiveView(puzzle, game),
        rewardGold: puzzle.rewardGold,
        rewardXp: puzzle.rewardXp,
      },
      solved,
      streak,
      nextResetAt: nextDailyReset(now).toISOString(),
    };
  }

  async completeToday(userId: number, puzzleId: number): Promise<PuzzleReward> {
    const { date, puzzle } = await this.today();
    if (!puzzle || puzzle.id !== puzzleId)
      throw new BadRequestException('Ce défi n’est plus le défi du jour.');

    const reward = await this.dataSource.transaction(async (m) => {
      // La contrainte unique (user_id, date) arbitre deux résolutions simultanées.
      const inserted = await m
        .createQueryBuilder()
        .insert()
        .into(UserPuzzleSolve)
        .values({ userId, date, puzzleId, solvedAt: new Date() })
        .orIgnore()
        .execute();
      const first =
        (inserted.raw as { affectedRows?: number } | undefined)
          ?.affectedRows === 1;
      const days = await m.find(UserPuzzleSolve, {
        where: { userId },
        select: ['date'],
      });
      const streak = computeStreak(
        days.map((d) => d.date),
        date,
      );
      if (!first)
        return { firstSolve: false, gold: 0, xp: 0, booster: false, streak };
      await this.users.addGold(userId, puzzle.rewardGold, m);
      await this.users.addExperience(userId, puzzle.rewardXp, m);
      const booster = earnsBooster(streak.current);
      if (booster)
        await this.users.addBoosterToUser(
          userId,
          ACHIEVEMENT_REWARD_BOOSTER_ID,
          1,
          m,
        );
      return {
        firstSolve: true,
        gold: puzzle.rewardGold,
        xp: puzzle.rewardXp,
        booster,
        streak,
      };
    });
    if (reward.firstSolve) this.events.emit('puzzle.solved', { userId, date });
    return reward;
  }

  /** État de départ désérialisé pour ce joueur (sièges : userId et -userId). */
  async load(
    puzzleId: number,
    user: { userId: number; username: string },
  ): Promise<LoadedPuzzle> {
    const puzzle = await this.puzzles.findOneBy({ id: puzzleId });
    if (!puzzle) throw new NotFoundException('Défi introuvable.');
    const ids = collectCardIds(puzzle.state);
    const found = ids.length ? await this.cards.findBy({ id: In(ids) }) : [];
    const game = deserializeGame(
      puzzle.state,
      new Map(found.map((c) => [c.id, c])),
      {
        matchId: -user.userId,
        p1: { userId: user.userId, username: user.username, socketId: '' },
        p2: { userId: -user.userId, username: 'Défi', socketId: '' },
      },
    );
    return {
      puzzle,
      objective: { type: puzzle.objectiveType, ...puzzle.objectiveParams },
      game,
    };
  }
}
