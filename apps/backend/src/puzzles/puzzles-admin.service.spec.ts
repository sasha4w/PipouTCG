import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import {
  PuzzleObjectiveType,
  PuzzleScheduleOrigin,
  PuzzleStatus,
} from '@pipou/shared';
import type { GameEngine } from '../fights/engine/game-engine';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { SandboxScenario } from '../sandbox/sandbox-scenario.entity';
import type { DailyPuzzle } from './daily-puzzle.entity';
import type { DailyPuzzleSchedule } from './daily-puzzle-schedule.entity';
import type { UserPuzzleSolve } from './user-puzzle-solve.entity';
import { PuzzlesAdminService } from './puzzles-admin.service';
import type { PuzzlesService } from './puzzles.service';
import { addDays, puzzleDay } from './puzzle-schedule';
import { solvePuzzle } from './puzzle-solver';
import { validateObjective, validateStart } from './puzzle-objective';

jest.mock('./puzzle-solver', () => ({ solvePuzzle: jest.fn() }));
jest.mock('./puzzle-step', () => ({ playPuzzleAction: jest.fn() }));
jest.mock('./puzzle-objective', () => ({
  startTrack: jest.fn().mockReturnValue({ destroyed: [] }),
  validateStart: jest.fn(),
  validateObjective: jest.fn(),
}));
jest.mock('../fights/ai/ai-review', () => ({
  describeAction: (a: { type: string }) => `joue ${a.type}`,
}));

const TODAY = puzzleDay(new Date());
const ADMIN = { userId: 1, username: 'Admin' };
const BODY = {
  title: ' Mon défi ',
  objective: { type: PuzzleObjectiveType.CLEAR_ENEMY_BOARD },
};

const fakePuzzle = (over: Partial<DailyPuzzle> = {}): DailyPuzzle =>
  ({
    id: 4,
    title: 'Défi',
    description: null,
    state: { a: 1 },
    objectiveType: PuzzleObjectiveType.WIN_GAME,
    objectiveParams: {},
    seed: 9,
    rewardGold: 100,
    rewardXp: 50,
    status: PuzzleStatus.DRAFT,
    verifiedAt: null,
    ...over,
  }) as DailyPuzzle;

const published = () =>
  fakePuzzle({ status: PuzzleStatus.PUBLISHED, verifiedAt: new Date() });

function setup(
  opts: { stored?: DailyPuzzle | null; solvedToday?: boolean } = {},
) {
  const stored = opts.stored === undefined ? fakePuzzle() : opts.stored;
  const repo = {
    findOneBy: jest.fn().mockResolvedValue(stored),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((x: object) => x),
    save: jest.fn((x: object) => Promise.resolve({ ...x, id: 77 })),
    find: jest.fn().mockResolvedValue([]),
  };
  const schedule = {
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const solves = {
    exists: jest.fn().mockResolvedValue(opts.solvedToday ?? false),
  };
  const scenarios = {
    create: jest.fn((x: object) => x),
    save: jest.fn((x: object) => Promise.resolve({ ...x, id: 12 })),
  };
  const game = {
    player1: {},
    player2: { monsterZones: [] },
  } as unknown as GameState;
  const puzzles = {
    load: jest.fn().mockResolvedValue({
      puzzle: stored,
      objective: { type: PuzzleObjectiveType.WIN_GAME },
      game,
    }),
    objectiveView: jest.fn(),
  };
  const service = new PuzzlesAdminService(
    repo as unknown as Repository<DailyPuzzle>,
    schedule as unknown as Repository<DailyPuzzleSchedule>,
    solves as unknown as Repository<UserPuzzleSolve>,
    scenarios as unknown as Repository<SandboxScenario>,
    puzzles as unknown as PuzzlesService,
    {} as GameEngine,
  );
  return { service, repo, schedule, solves, scenarios, puzzles };
}

/** Solveur suspendu jusqu'à `release()`, pour tester les accès concurrents. */
function hangingSolver() {
  let release = () => {};
  jest.mocked(solvePuzzle).mockImplementation(
    () =>
      new Promise((resolve) => {
        release = () =>
          resolve({ status: 'not_found', solution: [], nodes: 0, ms: 0 });
      }),
  );
  return () => release();
}

beforeEach(() => {
  jest.mocked(validateStart).mockReturnValue(null);
  jest.mocked(validateObjective).mockReturnValue(null);
});

describe('PuzzlesAdminService', () => {
  describe('update', () => {
    it('efface la vérification et repasse en brouillon', async () => {
      const { service, repo } = setup({ stored: published() });
      await service.update(4, BODY);
      expect(repo.update).toHaveBeenCalledWith(
        4,
        expect.objectContaining({
          title: 'Mon défi',
          status: PuzzleStatus.DRAFT,
          verifiedAt: null,
        }),
      );
    });

    it('retire les programmations d’aujourd’hui et du futur', async () => {
      const { service, schedule } = setup();
      await service.update(4, BODY);
      expect(schedule.delete).toHaveBeenCalledWith(
        expect.objectContaining({ puzzleId: 4 }),
      );
    });

    it('refuse de modifier le défi du jour déjà résolu', async () => {
      const { service, schedule, repo } = setup({ solvedToday: true });
      schedule.findOneBy.mockResolvedValue({ date: TODAY, puzzleId: 4 });
      await expect(service.update(4, BODY)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('refuse un objectif invalide', async () => {
      jest.mocked(validateObjective).mockReturnValue('Objectif KO');
      const { service, repo } = setup();
      await expect(service.update(4, BODY)).rejects.toThrow('Objectif KO');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('refuse la modification pendant la vérification', async () => {
      const release = hangingSolver();
      const { service } = setup();
      const first = service.verify(4, ADMIN);
      await new Promise((r) => setImmediate(r));
      await expect(service.update(4, BODY)).rejects.toThrow(ConflictException);
      release();
      await first;
    });
  });

  describe('verify', () => {
    it('pose verifiedAt et décrit les coups quand une solution existe', async () => {
      jest.mocked(solvePuzzle).mockResolvedValue({
        status: 'solved',
        solution: [{ type: 'end_phase' }],
        nodes: 5,
        ms: 3,
      });
      const { service, repo } = setup();
      const r = await service.verify(4, ADMIN);
      expect(r).toEqual({
        status: 'solved',
        solution: ['joue end_phase'],
        nodes: 5,
        ms: 3,
      });
      expect(repo.update).toHaveBeenCalledWith(4, {
        verifiedAt: expect.any(Date) as Date,
      });
    });

    it('ne pose rien sur not_found', async () => {
      jest.mocked(solvePuzzle).mockResolvedValue({
        status: 'not_found',
        solution: [],
        nodes: 9,
        ms: 1,
      });
      const { service, repo } = setup();
      const r = await service.verify(4, ADMIN);
      expect(r.status).toBe('not_found');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('refuse deux vérifications simultanées puis se libère', async () => {
      const release = hangingSolver();
      const { service } = setup();
      const first = service.verify(4, ADMIN);
      await new Promise((r) => setImmediate(r));
      await expect(service.verify(4, ADMIN)).rejects.toThrow(
        new ConflictException('Vérification déjà en cours.'),
      );
      release();
      await first;
      jest.mocked(solvePuzzle).mockResolvedValue({
        status: 'not_found',
        solution: [],
        nodes: 0,
        ms: 0,
      });
      await expect(service.verify(4, ADMIN)).resolves.toBeDefined();
    });
  });

  describe('publish / unpublish', () => {
    it('refuse sans vérification ni override', async () => {
      const { service } = setup();
      await expect(service.publish(4, {})).rejects.toThrow(
        new BadRequestException('Vérifie le défi avant de le publier.'),
      );
    });

    it('publie un défi vérifié', async () => {
      const { service, repo } = setup({
        stored: fakePuzzle({ verifiedAt: new Date() }),
      });
      await service.publish(4, {});
      expect(repo.update).toHaveBeenCalledWith(4, {
        status: PuzzleStatus.PUBLISHED,
      });
    });

    it('publie avec override et pose verifiedAt', async () => {
      const { service, repo } = setup();
      await service.publish(4, { manualOverride: true });
      expect(repo.update).toHaveBeenCalledWith(4, {
        status: PuzzleStatus.PUBLISHED,
        verifiedAt: expect.any(Date) as Date,
      });
    });

    it('dépublier retire les programmations et repasse en brouillon', async () => {
      const { service, repo, schedule } = setup({ stored: published() });
      await service.unpublish(4);
      expect(repo.update).toHaveBeenCalledWith(4, {
        status: PuzzleStatus.DRAFT,
      });
      expect(schedule.delete).toHaveBeenCalled();
    });

    it('dépublier le défi du jour résolu est refusé', async () => {
      const { service, schedule, repo } = setup({
        stored: published(),
        solvedToday: true,
      });
      schedule.findOneBy.mockResolvedValue({ date: TODAY, puzzleId: 4 });
      await expect(service.unpublish(4)).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('supprime', async () => {
      const { service, repo } = setup();
      await service.remove(4);
      expect(repo.delete).toHaveBeenCalledWith(4);
    });

    it('refuse si le défi du jour est résolu', async () => {
      const { service, schedule, repo } = setup({ solvedToday: true });
      schedule.findOneBy.mockResolvedValue({ date: TODAY, puzzleId: 4 });
      await expect(service.remove(4)).rejects.toThrow(BadRequestException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('setSchedule', () => {
    it('programme un défi publié et vérifié (manual)', async () => {
      const { service, schedule } = setup({ stored: published() });
      const date = addDays(TODAY, 2);
      await service.setSchedule({ date, puzzleId: 4 });
      expect(schedule.upsert).toHaveBeenCalledWith(
        { date, puzzleId: 4, origin: PuzzleScheduleOrigin.MANUAL },
        ['date'],
      );
    });

    it('refuse un défi non publié', async () => {
      const { service } = setup();
      await expect(
        service.setSchedule({ date: addDays(TODAY, 1), puzzleId: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un défi publié mais non vérifié', async () => {
      const { service } = setup({
        stored: fakePuzzle({ status: PuzzleStatus.PUBLISHED }),
      });
      await expect(
        service.setSchedule({ date: addDays(TODAY, 1), puzzleId: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse une date passée', async () => {
      const { service } = setup({ stored: published() });
      await expect(
        service.setSchedule({ date: addDays(TODAY, -1), puzzleId: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse de remplacer le défi du jour déjà résolu', async () => {
      const { service } = setup({ stored: published(), solvedToday: true });
      await expect(
        service.setSchedule({ date: TODAY, puzzleId: 4 }),
      ).rejects.toThrow(
        'Le défi du jour a déjà été résolu : impossible de le remplacer.',
      );
    });

    it('libère une date : supprime la ligne', async () => {
      const { service, schedule } = setup();
      const date = addDays(TODAY, 3);
      await service.setSchedule({ date, puzzleId: null });
      expect(schedule.delete).toHaveBeenCalledWith({ date });
    });

    it('refuse un défi introuvable', async () => {
      const { service } = setup({ stored: null });
      await expect(
        service.setSchedule({ date: addDays(TODAY, 1), puzzleId: 4 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSchedule', () => {
    it('renvoie une entrée par jour, vide si rien de programmé', async () => {
      const { service, schedule } = setup();
      schedule.find.mockResolvedValue([
        {
          date: addDays(TODAY, 1),
          puzzleId: 4,
          origin: PuzzleScheduleOrigin.MANUAL,
          puzzle: { title: 'Défi' },
        },
      ]);
      const r = await service.getSchedule(3);
      expect(r).toHaveLength(3);
      expect(r[0]).toEqual({
        date: TODAY,
        puzzleId: null,
        title: null,
        origin: null,
      });
      expect(r[1]).toEqual({
        date: addDays(TODAY, 1),
        puzzleId: 4,
        title: 'Défi',
        origin: PuzzleScheduleOrigin.MANUAL,
      });
    });
  });

  describe('createFromSandbox', () => {
    it('enregistre un brouillon non vérifié', async () => {
      const { service, repo } = setup();
      const id = await service.createFromSandbox(ADMIN, { a: 1 }, BODY);
      expect(id).toBe(77);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Mon défi',
          status: PuzzleStatus.DRAFT,
          verifiedAt: null,
          rewardGold: 100,
          rewardXp: 50,
        }),
      );
    });

    it('refuse un état hors phase principale du joueur 1 et nettoie', async () => {
      jest.mocked(validateStart).mockReturnValue('Phase KO');
      const { service, repo } = setup();
      await expect(
        service.createFromSandbox(ADMIN, { a: 1 }, BODY),
      ).rejects.toThrow('Phase KO');
      expect(repo.delete).toHaveBeenCalledWith(77);
    });

    it('refuse un objectif invalide et nettoie', async () => {
      jest.mocked(validateObjective).mockReturnValue('Objectif KO');
      const { service, repo } = setup();
      await expect(
        service.createFromSandbox(ADMIN, { a: 1 }, BODY),
      ).rejects.toThrow('Objectif KO');
      expect(repo.delete).toHaveBeenCalledWith(77);
    });

    it('refuse un titre vide ou des récompenses hors bornes', async () => {
      const { service, repo } = setup();
      await expect(
        service.createFromSandbox(ADMIN, {}, { ...BODY, title: '  ' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createFromSandbox(ADMIN, {}, { ...BODY, rewardGold: 99_999 }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('createScenario', () => {
    it('copie l’état dans un scénario nommé', async () => {
      const { service, scenarios } = setup();
      const r = await service.createScenario(4, 1);
      expect(r).toEqual({ scenarioId: 12 });
      expect(scenarios.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Défi #4 — Défi',
          state: { a: 1 },
          createdById: 1,
        }),
      );
    });
  });
});
