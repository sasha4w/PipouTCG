import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  PuzzleObjectiveType,
  PuzzleScheduleOrigin,
  PuzzleStatus,
} from '@pipou/shared';
import type {
  AdminPuzzle,
  PuzzlePublishBody,
  PuzzleSaveBody,
  PuzzleScheduleBody,
  PuzzleScheduleEntry,
  PuzzleVerifyResult,
} from '@pipou/shared';
import { describeAction } from '../fights/ai/ai-review';
import { GameEngine } from '../fights/engine/game-engine';
import { SandboxScenario } from '../sandbox/sandbox-scenario.entity';
import type { SerializedGame } from '../sandbox/scenario-serializer';
import { DailyPuzzle } from './daily-puzzle.entity';
import { DailyPuzzleSchedule } from './daily-puzzle-schedule.entity';
import { UserPuzzleSolve } from './user-puzzle-solve.entity';
import { PuzzlesService } from './puzzles.service';
import {
  startTrack,
  validateObjective,
  validateStart,
} from './puzzle-objective';
import { addDays, puzzleDay } from './puzzle-schedule';
import { solvePuzzle } from './puzzle-solver';
import { playPuzzleAction } from './puzzle-step';

type Admin = { userId: number; username: string };

const DEFAULT_GOLD = 100;
const DEFAULT_XP = 50;
const NO_USER: Admin = { userId: 0, username: '' };

/**
 * Administration des défis. Invariant : seul un défi publié ET vérifié sur son
 * état courant peut être programmé ou joué (PuzzlesService.today le revérifie).
 */
@Injectable()
export class PuzzlesAdminService {
  /** Défis en cours de vérification : une seule recherche à la fois, tous défis confondus. */
  private readonly verifying = new Set<number>();
  /**
   * Défis en cours de modification. Le verrou est pris de façon synchrone au
   * début de update(), avant tout await : une vérification ne peut donc pas
   * démarrer, charger l'ancien objectif puis poser verifiedAt après la
   * modification. Un garde sur updatedAt serait moins sûr (précision à la
   * seconde : deux écritures dans la même seconde restent indiscernables).
   */
  private readonly editing = new Set<number>();

  constructor(
    @InjectRepository(DailyPuzzle)
    private readonly repo: Repository<DailyPuzzle>,
    @InjectRepository(DailyPuzzleSchedule)
    private readonly schedule: Repository<DailyPuzzleSchedule>,
    @InjectRepository(UserPuzzleSolve)
    private readonly solves: Repository<UserPuzzleSolve>,
    @InjectRepository(SandboxScenario)
    private readonly scenarios: Repository<SandboxScenario>,
    private readonly puzzles: PuzzlesService,
    private readonly engine: GameEngine,
  ) {}

  async list(): Promise<AdminPuzzle[]> {
    const today = puzzleDay(new Date());
    const [rows, planned] = await Promise.all([
      this.repo.find({
        relations: { createdBy: true },
        order: { updatedAt: 'DESC' },
      }),
      this.schedule.find({ select: ['puzzleId', 'date'] }),
    ]);
    const lastPlayed = new Map<number, string>();
    for (const s of planned) {
      if (s.date > today) continue;
      const prev = lastPlayed.get(s.puzzleId);
      if (!prev || s.date > prev) lastPlayed.set(s.puzzleId, s.date);
    }
    return Promise.all(
      rows.map(async (p) => {
        // Une carte supprimée depuis l'enregistrement rend l'état illisible : liste dégradée.
        let game: Awaited<ReturnType<PuzzlesService['load']>>['game'] | null =
          null;
        try {
          game = (await this.puzzles.load(p.id, NO_USER)).game;
        } catch {
          game = null;
        }
        return {
          id: p.id,
          title: p.title,
          description: p.description,
          objective: this.puzzles.objectiveView(p, game ?? undefined),
          rewardGold: p.rewardGold,
          rewardXp: p.rewardXp,
          status: p.status,
          seed: p.seed,
          verifiedAt: p.verifiedAt?.toISOString() ?? null,
          createdBy: p.createdBy?.username ?? '',
          updatedAt: p.updatedAt.toISOString(),
          lastPlayed: lastPlayed.get(p.id) ?? null,
          enemyMonsters: (game?.player2.monsterZones ?? []).flatMap((m) =>
            m ? [{ instanceId: m.instanceId, name: m.card.baseCard.name }] : [],
          ),
        };
      }),
    );
  }

  /**
   * Toute modification invalide la vérification : le défi repasse en brouillon
   * et quitte le calendrier (aujourd'hui compris, sinon today() ne trouverait
   * plus de défi jouable). Refusé si le défi du jour est déjà résolu.
   */
  async update(id: number, body: PuzzleSaveBody): Promise<void> {
    if (this.verifying.has(id))
      throw new ConflictException('Vérification en cours : réessaie après.');
    if (this.editing.has(id))
      throw new ConflictException('Modification déjà en cours.');
    this.editing.add(id);
    try {
      const puzzle = await this.find(id);
      const fields = this.fieldsOf(body);
      const { game } = await this.puzzles.load(id, NO_USER);
      const problem = validateObjective(
        { type: fields.objectiveType, ...fields.objectiveParams },
        game,
      );
      if (problem) throw new BadRequestException(problem);
      await this.leaveSchedule(puzzle.id);
      await this.repo.update(id, {
        ...fields,
        rewardGold: fields.rewardGold ?? puzzle.rewardGold,
        rewardXp: fields.rewardXp ?? puzzle.rewardXp,
        status: PuzzleStatus.DRAFT,
        verifiedAt: null,
      });
    } finally {
      this.editing.delete(id);
    }
  }

  async verify(id: number, admin: Admin): Promise<PuzzleVerifyResult> {
    if (this.verifying.has(id))
      throw new ConflictException('Vérification déjà en cours.');
    if (this.verifying.size >= 1)
      throw new ConflictException(
        'Une autre vérification est en cours : réessaie après.',
      );
    if (this.editing.has(id))
      throw new ConflictException('Modification en cours : réessaie après.');
    this.verifying.add(id);
    try {
      const { puzzle, objective, game } = await this.puzzles.load(id, admin);
      const problem = validateStart(game) ?? validateObjective(objective, game);
      if (problem) throw new BadRequestException(problem);
      const result = await solvePuzzle(
        this.engine,
        game,
        objective,
        puzzle.seed,
      );
      if (result.status === 'solved')
        await this.repo.update(id, { verifiedAt: new Date() });
      // Les coups sont décrits sur l'état où ils sont joués.
      const replay = structuredClone(game);
      const track = startTrack(replay);
      const solution = result.solution.map((a) => {
        const text = describeAction(a, replay);
        playPuzzleAction(this.engine, replay, a, puzzle.seed, track);
        return text;
      });
      return {
        status: result.status,
        solution,
        nodes: result.nodes,
        ms: result.ms,
      };
    } finally {
      this.verifying.delete(id);
    }
  }

  async publish(id: number, body: PuzzlePublishBody): Promise<void> {
    const puzzle = await this.find(id);
    if (!puzzle.verifiedAt && !body.manualOverride)
      throw new BadRequestException('Vérifie le défi avant de le publier.');
    await this.repo.update(
      id,
      puzzle.verifiedAt
        ? { status: PuzzleStatus.PUBLISHED }
        : { status: PuzzleStatus.PUBLISHED, verifiedAt: new Date() },
    );
  }

  /** Retire aussi le défi du calendrier (aujourd'hui et futur), sauf s'il est déjà résolu. */
  async unpublish(id: number): Promise<void> {
    const puzzle = await this.find(id);
    await this.leaveSchedule(puzzle.id);
    await this.repo.update(id, { status: PuzzleStatus.DRAFT });
  }

  async remove(id: number): Promise<void> {
    await this.find(id);
    await this.assertTodayNotSolved(id);
    // Le calendrier suit en cascade (clé étrangère).
    await this.repo.delete(id);
  }

  async getSchedule(days: number): Promise<PuzzleScheduleEntry[]> {
    const start = puzzleDay(new Date());
    const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
    const rows = await this.schedule.find({
      where: { date: In(dates) },
      relations: { puzzle: true },
    });
    const byDate = new Map(rows.map((r) => [r.date, r]));
    return dates.map((date) => {
      const row = byDate.get(date);
      return {
        date,
        puzzleId: row?.puzzleId ?? null,
        title: row?.puzzle.title ?? null,
        origin: row?.origin ?? null,
      };
    });
  }

  async setSchedule(body: PuzzleScheduleBody): Promise<void> {
    const today = puzzleDay(new Date());
    if (body.date < today)
      throw new BadRequestException(
        'Impossible de programmer une date passée.',
      );
    if (body.date === today) await this.assertTodaySolvedFree();

    if (body.puzzleId === null) {
      await this.schedule.delete({ date: body.date });
      return;
    }
    const puzzle = await this.find(body.puzzleId);
    if (puzzle.status !== PuzzleStatus.PUBLISHED || !puzzle.verifiedAt)
      throw new BadRequestException(
        'Seul un défi publié et vérifié peut être programmé.',
      );
    await this.schedule.upsert(
      {
        date: body.date,
        puzzleId: puzzle.id,
        origin: PuzzleScheduleOrigin.MANUAL,
      },
      ['date'],
    );
  }

  async createFromSandbox(
    admin: Admin,
    state: SerializedGame,
    body: PuzzleSaveBody,
  ): Promise<number> {
    const fields = this.fieldsOf(body);
    const saved = await this.repo.save(
      this.repo.create({
        ...fields,
        state,
        seed: Math.floor(Math.random() * 2 ** 31),
        rewardGold: fields.rewardGold ?? DEFAULT_GOLD,
        rewardXp: fields.rewardXp ?? DEFAULT_XP,
        status: PuzzleStatus.DRAFT,
        verifiedAt: null,
        createdBy: { id: admin.userId },
      }),
    );
    // Validé sur l'état relu : même chemin que la partie réelle.
    try {
      const { objective, game } = await this.puzzles.load(saved.id, admin);
      const problem = validateStart(game) ?? validateObjective(objective, game);
      if (problem) throw new BadRequestException(problem);
    } catch (e) {
      await this.repo.delete(saved.id);
      throw e;
    }
    return saved.id;
  }

  /** Copie l'état du défi dans un scénario de sandbox (« Ouvrir dans le sandbox »). */
  async createScenario(
    id: number,
    adminUserId: number,
  ): Promise<{ scenarioId: number }> {
    const puzzle = await this.find(id);
    const row = await this.scenarios.save(
      this.scenarios.create({
        name: `Défi #${puzzle.id} — ${puzzle.title}`.slice(0, 80),
        description: null,
        state: puzzle.state,
        createdById: adminUserId,
      }),
    );
    return { scenarioId: row.id };
  }

  private async find(id: number): Promise<DailyPuzzle> {
    const puzzle = await this.repo.findOneBy({ id });
    if (!puzzle) throw new NotFoundException('Défi introuvable.');
    return puzzle;
  }

  /** Valide le corps (le socket du sandbox n'a pas de pipe de validation) et le met en colonnes. */
  private fieldsOf(body: PuzzleSaveBody) {
    // Le payload socket n'est pas typé à l'exécution : on vérifie chaque type.
    if (typeof body !== 'object' || body === null)
      throw new BadRequestException('Corps invalide.');
    if (typeof body.title !== 'string')
      throw new BadRequestException('Le titre doit être un texte.');
    const title = body.title.trim();
    if (title.length < 1 || title.length > 80)
      throw new BadRequestException('Le titre doit faire 1 à 80 caractères.');
    if (body.description != null && typeof body.description !== 'string')
      throw new BadRequestException('La description doit être un texte.');
    const description = body.description?.trim() || null;
    if (description && description.length > 255)
      throw new BadRequestException('Description trop longue (255 max).');
    if (
      typeof body.objective !== 'object' ||
      body.objective === null ||
      !Object.values(PuzzleObjectiveType).includes(body.objective.type)
    )
      throw new BadRequestException('Objectif inconnu.');
    const inRange = (v: unknown, max: number) =>
      v === undefined ||
      (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max);
    if (!inRange(body.rewardGold, 10_000))
      throw new BadRequestException('Or : entier de 0 à 10 000.');
    if (!inRange(body.rewardXp, 5_000))
      throw new BadRequestException('XP : entier de 0 à 5 000.');
    return {
      title,
      description,
      objectiveType: body.objective.type,
      objectiveParams: {
        targetInstanceId: body.objective.targetInstanceId,
        primes: body.objective.primes,
      },
      rewardGold: body.rewardGold,
      rewardXp: body.rewardXp,
    };
  }

  /** Défi du jour déjà résolu par quelqu'un : on ne le retire ni ne le remplace. */
  private async assertTodaySolvedFree(): Promise<void> {
    const today = puzzleDay(new Date());
    if (await this.solves.exists({ where: { date: today } }))
      throw new BadRequestException(
        'Le défi du jour a déjà été résolu : impossible de le remplacer.',
      );
  }

  private async assertTodayNotSolved(puzzleId: number): Promise<void> {
    const today = puzzleDay(new Date());
    const row = await this.schedule.findOneBy({ date: today, puzzleId });
    if (row && (await this.solves.exists({ where: { date: today } })))
      throw new BadRequestException(
        'Ce défi est le défi du jour et a déjà été résolu : impossible de le modifier.',
      );
  }

  /** Retire un défi du calendrier d'aujourd'hui et du futur ; le passé reste (historique). */
  private async leaveSchedule(puzzleId: number): Promise<void> {
    await this.assertTodayNotSolved(puzzleId);
    await this.schedule.delete({
      puzzleId,
      date: MoreThanOrEqual(puzzleDay(new Date())),
    });
  }
}
