import type { DataSource, EntityManager } from 'typeorm';
import { TUTORIAL_LESSONS, TUTORIAL_REWARD } from '@pipou/shared';
import type { UsersService } from '../users/users.service';
import { allRealCards } from '../fights/testing/real-cards';
import { TutorialService } from './tutorial.service';

/** Base factice : `insert ignore` n'ajoute une ligne que la première fois. */
function setup(completed: string[] = []) {
  const done = new Set(completed);
  const inserted: string[] = [];
  const builder = {
    insert: () => builder,
    into: () => builder,
    orIgnore: () => builder,
    updateEntity: () => builder,
    values: (v: { userId: number; lessonId: string }) => {
      builder.row = v;
      return builder;
    },
    row: { userId: 0, lessonId: '' },
    execute: () => {
      const fresh = !done.has(builder.row.lessonId);
      if (fresh) {
        done.add(builder.row.lessonId);
        inserted.push(builder.row.lessonId);
      }
      return Promise.resolve({ raw: { affectedRows: fresh ? 1 : 0 } });
    },
  };
  const manager = {
    createQueryBuilder: () => builder,
  } as unknown as EntityManager;
  const dataSource = {
    manager: {
      find: (_entity: unknown, opts?: { where?: unknown }) =>
        opts
          ? Promise.resolve([...done].map((lessonId) => ({ lessonId })))
          : Promise.resolve(allRealCards()),
    },
    transaction: <T>(fn: (m: EntityManager) => Promise<T>) => fn(manager),
  } as unknown as DataSource;
  const users = {
    addGold: jest.fn().mockResolvedValue(undefined),
    addExperience: jest.fn().mockResolvedValue(undefined),
  };
  const service = new TutorialService(
    dataSource,
    users as unknown as UsersService,
  );
  return { service, users, inserted };
}

describe('TutorialService.recordResult', () => {
  it('verse la récompense à la première leçon terminée', async () => {
    const { service, users } = setup();
    const res = await service.recordResult(7, 'first-turn', true);
    expect(res).toEqual({
      lessonId: 'first-turn',
      completed: true,
      firstCompletion: true,
      gold: TUTORIAL_REWARD.gold,
      xp: TUTORIAL_REWARD.xp,
    });
    expect(users.addGold).toHaveBeenCalledWith(7, 100, expect.anything());
    expect(users.addExperience).toHaveBeenCalledWith(7, 50, expect.anything());
  });

  it('ne paie jamais deux fois la même leçon', async () => {
    const { service, users } = setup();
    await service.recordResult(7, 'combat', true);
    const again = await service.recordResult(7, 'combat', true);
    expect(again).toMatchObject({
      completed: true,
      firstCompletion: false,
      gold: 0,
      xp: 0,
    });
    expect(users.addGold).toHaveBeenCalledTimes(1);
    expect(users.addExperience).toHaveBeenCalledTimes(1);
  });

  it('ne paie pas deux fois quand deux fins arrivent en même temps', async () => {
    const { service, users } = setup();
    await Promise.all([
      service.recordResult(7, 'guard', true),
      service.recordResult(7, 'guard', true),
    ]);
    expect(users.addGold).toHaveBeenCalledTimes(1);
  });

  it('paie chaque leçon une fois', async () => {
    const { service, users } = setup();
    for (const id of TUTORIAL_LESSONS) await service.recordResult(7, id, true);
    expect(users.addGold).toHaveBeenCalledTimes(TUTORIAL_LESSONS.length);
  });

  it("n'enregistre rien et ne paie rien pour une leçon abandonnée", async () => {
    const { service, users, inserted } = setup();
    const res = await service.recordResult(7, 'supports', false);
    expect(res).toEqual({
      lessonId: 'supports',
      completed: false,
      firstCompletion: false,
      gold: 0,
      xp: 0,
    });
    expect(inserted).toEqual([]);
    expect(users.addGold).not.toHaveBeenCalled();
  });
});

describe('TutorialService.getOverview', () => {
  it("liste les 9 leçons dans l'ordre, avec celles déjà terminées", async () => {
    const { service } = setup(['combat', 'pipou']);
    const overview = await service.getOverview(7);
    expect(overview.lessons.map((l) => l.id)).toEqual([...TUTORIAL_LESSONS]);
    expect(
      overview.lessons.filter((l) => l.completed).map((l) => l.id),
    ).toEqual(['combat', 'pipou']);
    expect(overview.reward).toEqual(TUTORIAL_REWARD);
  });
});

describe('TutorialService.prepare', () => {
  it("prépare le plateau de la leçon, le joueur en p1 et l'adversaire scripté", async () => {
    const { service } = setup();
    const start = await service.prepare(7, 'Élève', 'first-turn');
    expect(start.lessonId).toBe('first-turn');
    expect(start.game.player1.userId).toBe(7);
    expect(start.game.player1.username).toBe('Élève');
    expect(start.game.player2.userId).toBe(start.game.matchId);
    expect(start.game.matchId).toBeLessThan(0);
    expect(start.runner.index).toBe(0);
    expect(start.game.phase).toBe('main');
  });
});
