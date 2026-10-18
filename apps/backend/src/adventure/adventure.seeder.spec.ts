import { Rarity } from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import { allRealCards } from '../fights/testing/real-cards';
import { AdventureSeeder, LAUNCH_WORLDS } from './adventure.seeder';
import { AdventureOpponentCard } from './entities/adventure-opponent-card.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureWorld } from './entities/adventure-world.entity';

const ALL = allRealCards();
const SETS: Record<number, string> = {
  1: 'Pipou',
  2: 'SquareWorld',
  3: 'Drakon',
};
const ARCH: Record<number, string> = { 1: 'pipou', 2: 'pixelman', 3: 'dragon' };

interface Row {
  id?: number;
  [k: string]: unknown;
}

function setup(opts?: {
  missingSets?: number[];
  noLegendary?: number[];
  noBooster?: number[];
  failOpponentSave?: number;
  existingWorldSetIds?: number[];
}) {
  const worlds: Row[] = (opts?.existingWorldSetIds ?? []).map(
    (cardSetId, i) => ({
      id: 100 + i,
      cardSetId,
    }),
  );
  const opponents: Row[] = [];
  const opponentCards: Row[] = [];
  let nextId = 1;
  const stores = new Map<unknown, Row[]>([
    [AdventureWorld, worlds],
    [AdventureOpponent, opponents],
    [AdventureOpponentCard, opponentCards],
  ]);
  let opponentSaves = 0;
  const transaction = jest.fn(
    async (cb: (m: unknown) => Promise<void>): Promise<void> => {
      const staged = new Map<unknown, Row[]>();
      const manager = {
        create: (_e: unknown, o: object): Row => ({ ...o }),
        save: (entity: unknown, data: Row | Row[]) => {
          if (entity === AdventureOpponent) {
            opponentSaves++;
            if (opts?.failOpponentSave === opponentSaves)
              return Promise.reject(new Error('save KO'));
          }
          const list = Array.isArray(data) ? data : [data];
          for (const e of list) {
            if (e.id === undefined) e.id = nextId++;
            staged.set(entity, [...(staged.get(entity) ?? []), e]);
          }
          return Promise.resolve(data);
        },
      };
      await cb(manager);
      for (const [k, rows] of staged) stores.get(k)!.push(...rows);
    },
  );
  const worldRepo = { find: jest.fn(() => Promise.resolve(worlds)) };
  const cardRepo = {
    find: jest.fn(({ where }: { where: { cardSet: { id: number } } }) => {
      const id = where.cardSet.id;
      let cards: Card[] = ALL.filter((c) => c.archetype === ARCH[id]);
      if (opts?.noLegendary?.includes(id))
        cards = cards.map((c) =>
          c.rarity === Rarity.LEGENDARY ? { ...c, rarity: Rarity.EPIC } : c,
        );
      return Promise.resolve(cards);
    }),
  };
  const setRepo = {
    find: jest.fn(() =>
      Promise.resolve(
        Object.entries(SETS)
          .filter(([id]) => !opts?.missingSets?.includes(Number(id)))
          .map(([id, name]) => ({ id: Number(id), name })),
      ),
    ),
  };
  const boosterRepo = {
    find: jest.fn(() =>
      Promise.resolve(
        [30, 20, 10]
          .map((n, i) => ({ id: n + 1, cardSet: { id: 3 - i } }))
          .concat([
            { id: 99, cardSet: { id: 1 } },
            { id: 98, cardSet: { id: 2 } },
          ])
          .filter((b) => !opts?.noBooster?.includes(b.cardSet.id))
          .concat([{ id: 1, cardSet: null as never }]),
      ),
    ),
  };
  const seeder = new AdventureSeeder(
    worldRepo as never,
    cardRepo as never,
    setRepo as never,
    boosterRepo as never,
    { transaction } as never,
  );
  let t = 0.123;
  seeder.random = () => (t = (t * 9301 + 0.49297) % 1);
  const log = jest.spyOn(seeder['logger'], 'warn').mockImplementation();
  const errLog = jest.spyOn(seeder['logger'], 'error').mockImplementation();
  return { seeder, worlds, opponents, opponentCards, log, errLog };
}

describe('AdventureSeeder', () => {
  it('LAUNCH_WORLDS : 3 mondes ordonnés', () => {
    expect(LAUNCH_WORLDS).toEqual([
      { cardSetId: 1, archetype: 'pipou', order: 1 },
      { cardSetId: 2, archetype: 'pixelman', order: 2 },
      { cardSetId: 3, archetype: 'dragon', order: 3 },
    ]);
  });

  it('crée 3 mondes x 5 IA quand rien n existe', async () => {
    const { seeder, worlds, opponents, opponentCards } = setup();
    await seeder.seed();
    expect(worlds).toHaveLength(3);
    expect(worlds.map((w) => w.name)).toEqual([
      'Pipou',
      'SquareWorld',
      'Drakon',
    ]);
    expect(worlds.map((w) => w.order)).toEqual([1, 2, 3]);
    expect(worlds.every((w) => w.isActive === true)).toBe(true);
    expect(opponents).toHaveLength(15);
    expect(opponentCards.length).toBeGreaterThan(15);
  });

  it('prend le plus petit id de booster du set', async () => {
    const { seeder, worlds } = setup();
    await seeder.seed();
    expect(worlds.map((w) => w.boosterId)).toEqual([11, 21, 31]);
  });

  it('IA : position, portrait, signature JSON, récompenses, deck 30..40', async () => {
    const { seeder, worlds, opponents, opponentCards } = setup();
    await seeder.seed();
    const w = worlds[2];
    const mine = opponents.filter((o) => o.worldId === w.id);
    expect(mine.map((o) => o.position)).toEqual([1, 2, 3, 4, 5]);
    const first = mine[0];
    const sig = JSON.parse(first.signature as string) as {
      archetype: string;
      cardName: string;
      element?: string;
    };
    expect(sig).toMatchObject({
      archetype: 'dragon',
      cardName: 'Adulte Teros',
      element: 'earth',
    });
    const portrait = ALL.find((c) => c.name === 'Adulte Teros')!;
    expect(first.portraitCardId).toBe(portrait.id);
    expect(first.firstWinGold).toBe(100);
    expect(mine[4].farmLegendaryPct).toBe(2);
    expect((first.signature as string).length).toBeLessThanOrEqual(255);
    for (const o of mine) {
      expect((o.name as string).length).toBeGreaterThan(0);
      expect((o.quote as string).length).toBeLessThanOrEqual(255);
      const qty = opponentCards
        .filter((c) => c.opponentId === o.id)
        .reduce((s, c) => s + (c.quantity as number), 0);
      expect(qty).toBeGreaterThanOrEqual(30);
      expect(qty).toBeLessThanOrEqual(40);
    }
  });

  it('ne recrée rien au 2e appel / si le monde existe déjà', async () => {
    const { seeder, worlds, opponents } = setup({
      existingWorldSetIds: [1, 2, 3],
    });
    await seeder.seed();
    expect(worlds).toHaveLength(3);
    expect(opponents).toHaveLength(0);
  });

  it('ne crée que les mondes manquants', async () => {
    const { seeder, worlds } = setup({ existingWorldSetIds: [1] });
    await seeder.seed();
    expect(worlds).toHaveLength(3);
    expect(worlds.filter((w) => w.name).map((w) => w.name)).toEqual([
      'SquareWorld',
      'Drakon',
    ]);
  });

  it('set sans légendaire : monde créé inactif', async () => {
    const { seeder, worlds } = setup({ noLegendary: [2] });
    await seeder.seed();
    expect(worlds.map((w) => w.isActive)).toEqual([true, false, true]);
  });

  it('set sans booster : monde créé inactif, boosterId null', async () => {
    const { seeder, worlds } = setup({ noBooster: [1] });
    expect(worlds).toHaveLength(0);
    await seeder.seed();
    expect(worlds[0]).toMatchObject({ boosterId: null, isActive: false });
  });

  it('set absent : monde ignoré + log', async () => {
    const { seeder, worlds, log } = setup({ missingSets: [2] });
    await seeder.seed();
    expect(worlds.map((w) => w.name)).toEqual(['Pipou', 'Drakon']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('2'));
  });

  it('échec en cours de monde : rien de persisté pour ce monde, les autres sont créés', async () => {
    // 6e sauvegarde d'IA = 1re IA du 2e monde (pixelman) ... on échoue à la 8e
    const { seeder, worlds, opponents, opponentCards, errLog } = setup({
      failOpponentSave: 8,
    });
    await seeder.seed();
    expect(worlds.map((w) => w.name)).toEqual(['Pipou', 'Drakon']);
    expect(opponents).toHaveLength(10);
    const ids = new Set(worlds.map((w) => w.id));
    expect(opponents.every((o) => ids.has(o.worldId as number))).toBe(true);
    expect(
      opponentCards.every((c) => opponents.some((o) => o.id === c.opponentId)),
    ).toBe(true);
    expect(errLog).toHaveBeenCalledTimes(1);
  });

  it('booster sans set ignoré, sans crash', async () => {
    const { seeder, worlds } = setup();
    await seeder.seed();
    expect(worlds).toHaveLength(3);
  });

  it('onApplicationBootstrap journalise sans propager', async () => {
    const { seeder } = setup();
    jest.spyOn(seeder, 'seed').mockRejectedValue(new Error('boom'));
    const err = jest.spyOn(seeder['logger'], 'error').mockImplementation();
    await expect(seeder.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
  });
});
