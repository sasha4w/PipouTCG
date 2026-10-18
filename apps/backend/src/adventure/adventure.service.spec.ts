import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { FindOperator, type DataSource } from 'typeorm';
import { ADVENTURE_LEVEL_DEFAULTS, Rarity } from '@pipou/shared';
import type { UsersService } from '../users/users.service';
import { Card } from '../cards/card.entity';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { PveInfo } from '../fights/pve';
import { AdventureService } from './adventure.service';
import { farmWindowStart } from './adventure-rules';
import { AdventureMatch } from './entities/adventure-match.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureSettings } from './entities/adventure-settings.entity';
import { AdventureWorld } from './entities/adventure-world.entity';

const USER = 7;
const AI = -99;
const NOW = new Date('2026-10-18T15:00:00');

// ── Base en mémoire ─────────────────────────────────────────────────────────

interface Row {
  [k: string]: unknown;
}

function card(id: number, setId: number, rarity: Rarity = Rarity.COMMON) {
  return {
    id,
    name: `Carte ${id}`,
    rarity,
    cardSet: { id: setId },
    image: { url: `${id}.png` },
  };
}

/** 10 cartes × 3 = deck de 30. */
function deck(setId: number, base: number, total = 30) {
  const rows: Row[] = [];
  for (let i = 0; i < 10; i++) {
    const quantity = Math.min(3, Math.max(0, total - i * 3));
    if (quantity > 0)
      rows.push({ cardId: base + i, quantity, card: card(base + i, setId) });
  }
  return rows;
}

function world(
  id: number,
  opts: { active?: boolean; prereqs?: number[]; boosterId?: number | null },
) {
  const boosterId = opts.boosterId === undefined ? id * 100 : opts.boosterId;
  const w: Row = {
    id,
    name: `Monde ${id}`,
    cardSetId: id * 10,
    cardSet: { id: id * 10, name: `Set ${id}` },
    boosterId,
    booster:
      boosterId === null ? null : { id: boosterId, name: `Booster ${id}` },
    order: id,
    isActive: opts.active ?? true,
    prerequisites: (opts.prereqs ?? []).map((p) => ({
      id: p,
      name: `Monde ${p}`,
    })),
  };
  const opponents = [1, 2, 3, 4, 5].map((position) => {
    const level = position as 1 | 2 | 3 | 4 | 5;
    return {
      id: id * 10 + position,
      worldId: id,
      world: w,
      position,
      name: `IA ${id}-${position}`,
      quote: '...',
      portraitCardId: 500 + position,
      portraitCard: card(500 + position, id * 10),
      signature: JSON.stringify({ archetype: 'pipou', cardName: 'X' }),
      ...ADVENTURE_LEVEL_DEFAULTS[level],
      cards: deck(id * 10, id * 1000),
    };
  });
  w.opponents = opponents;
  return w;
}

function matches(where: Row, row: Row): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v instanceof FindOperator) {
      const op = v as FindOperator<unknown>;
      if (op.type === 'isNull') return row[k] === null;
      if (op.type === 'moreThanOrEqual')
        return row[k] !== null && (row[k] as Date) >= (op.value as Date);
      throw new Error(`opérateur non géré : ${op.type}`);
    }
    return row[k] === v;
  });
}

function setup(opts?: { worlds?: Row[]; cards?: Row[]; dailyCap?: number }) {
  const worlds = opts?.worlds ?? [
    world(1, {}),
    world(2, { prereqs: [1] }),
    world(3, { active: false }),
  ];
  const opponents = worlds.flatMap((w) => w.opponents as Row[]);
  const cards = opts?.cards ?? [
    card(900, 10, Rarity.LEGENDARY),
    card(901, 10, Rarity.EPIC),
    card(902, 20, Rarity.LEGENDARY),
  ];
  const matchRows: Row[] = [];
  let nextId = 1;
  const log: string[] = [];

  const manager = {
    create: (_e: unknown, o: Row) => ({ ...o }),
    save: jest.fn((e: unknown, row: Row) => {
      if (e !== AdventureMatch) throw new Error('save inattendu');
      const saved = {
        id: nextId++,
        won: null,
        firstWin: false,
        rewarded: false,
        loot: null,
        endedAt: null,
        turns: 0,
        endReason: null,
        ...row,
      };
      matchRows.push(saved);
      return Promise.resolve(saved);
    }),
    find: jest.fn((e: unknown, o: { where?: Row }) => {
      if (e === AdventureWorld)
        return Promise.resolve(
          worlds.filter((w) => !o.where || matches(o.where, w)),
        );
      if (e === Card) {
        const w = o.where as { cardSet: { id: number }; rarity: string };
        return Promise.resolve(
          cards.filter(
            (c) =>
              (c.cardSet as { id: number }).id === w.cardSet.id &&
              c.rarity === w.rarity,
          ),
        );
      }
      throw new Error('find inattendu');
    }),
    findOne: jest.fn((e: unknown, o: { where: Row }) => {
      const id = o.where.id;
      if (e === AdventureOpponent)
        return Promise.resolve(opponents.find((x) => x.id === id) ?? null);
      if (e === AdventureMatch)
        return Promise.resolve(matchRows.find((m) => m.id === id) ?? null);
      if (e === AdventureSettings)
        return Promise.resolve(
          opts?.dailyCap === undefined
            ? null
            : { id: 1, dailyCap: opts.dailyCap },
        );
      throw new Error('findOne inattendu');
    }),
    count: jest.fn((e: unknown, o: { where: Row }) => {
      if (e !== AdventureMatch) throw new Error('count inattendu');
      return Promise.resolve(
        matchRows.filter((m) => matches(o.where, m)).length,
      );
    }),
    update: jest.fn((e: unknown, where: Row, patch: Row) => {
      if (e !== AdventureMatch) throw new Error('update inattendu');
      const hit = matchRows.filter((m) => matches(where, m));
      hit.forEach((m) => Object.assign(m, patch));
      return Promise.resolve({ affected: hit.length });
    }),
    createQueryBuilder: jest.fn(() => {
      let userId: number | undefined;
      const qb = {
        innerJoin: () => qb,
        select: () => qb,
        addSelect: () => qb,
        where: (_sql: string, params?: { userId: number }) => {
          userId = params?.userId;
          return qb;
        },
        andWhere: () => qb,
        groupBy: () => qb,
        addGroupBy: () => qb,
        getRawMany: () => {
          const wins = new Map<number, number>();
          for (const m of matchRows)
            if (m.userId === userId && m.won === true)
              wins.set(
                m.opponentId as number,
                (wins.get(m.opponentId as number) ?? 0) + 1,
              );
          return Promise.resolve(
            [...wins].map(([opponentId, n]) => {
              const o = opponents.find((x) => x.id === opponentId)!;
              // MySQL renvoie COUNT(*) en chaîne
              return {
                opponentId,
                worldId: o.worldId,
                position: o.position,
                wins: String(n),
              };
            }),
          );
        },
      };
      return qb;
    }),
  };

  const dataSource = {
    manager,
    transaction: jest.fn(
      async (cb: (m: typeof manager) => Promise<unknown>) => {
        log.push('begin');
        const r = await cb(manager);
        log.push('commit');
        return r;
      },
    ),
  };
  const users = {
    addGold: jest.fn(() => Promise.resolve()),
    addExperience: jest.fn(() => Promise.resolve()),
    addBoosterToUser: jest.fn(() => Promise.resolve()),
    addCardToUser: jest.fn(() => Promise.resolve()),
  };
  const events = {
    emit: jest.fn((name: string) => {
      log.push(`emit:${name}`);
      return true;
    }),
  };
  const service = new AdventureService(
    dataSource as unknown as DataSource,
    users as unknown as UsersService,
    events as unknown as EventEmitter2,
  );

  /** Combat terminé (won non nul) ou orphelin (won null). */
  function addMatch(row: Partial<AdventureMatch> & { opponentId: number }) {
    const full = {
      id: nextId++,
      userId: USER,
      won: true,
      firstWin: false,
      rewarded: false,
      loot: null,
      turns: 5,
      endReason: 'primes_depleted',
      startedAt: NOW,
      endedAt: NOW,
      ...row,
    };
    matchRows.push(full);
    return full;
  }

  /** Bats les IA 1..n du monde (1re victoire chacune). */
  function beat(worldId: number, upTo: number) {
    for (let p = 1; p <= upTo; p++)
      addMatch({
        opponentId: worldId * 10 + p,
        firstWin: true,
        rewarded: true,
      });
  }

  return {
    service,
    manager,
    dataSource,
    users,
    events,
    log,
    matchRows,
    addMatch,
    beat,
  };
}

function game(winner: number | undefined): GameState {
  return {
    matchId: AI,
    winner,
    endReason: 'primes_depleted',
    turnNumber: 9,
    player1: { userId: USER },
    player2: { userId: AI },
  } as unknown as GameState;
}

function pve(adventureMatchId: number, opponentId: number): PveInfo {
  return {
    adventureMatchId,
    opponentId,
    aiUserId: AI,
    profile: { archetype: 'pipou', level: 1 },
    timeouts: 0,
    aiActionsThisTurn: 0,
  };
}

async function startedMatch(
  ctx: ReturnType<typeof setup>,
  opponentId: number,
): Promise<number> {
  const start = await ctx.service.prepareStart(USER, opponentId);
  return start.adventureMatchId;
}

// ── getOverview ─────────────────────────────────────────────────────────────

describe('AdventureService.getOverview', () => {
  it('nouveau joueur : IA 1 disponible, les autres verrouillées', async () => {
    const { service } = setup();
    const o = await service.getOverview(USER, NOW);
    const w1 = o.worlds.find((w) => w.id === 1)!;
    expect(w1.unlocked).toBe(true);
    expect(w1.opponents.map((x) => x.state)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(w1.beaten).toBe(0);
    expect(w1.completed).toBe(false);
    expect(o.farmRewardsToday).toBe(0);
    expect(o.dailyCap).toBe(20);
  });

  it('mondes actifs uniquement, triés par ordre', async () => {
    const { service } = setup({
      worlds: [world(2, {}), world(1, {}), world(3, { active: false })],
    });
    const o = await service.getOverview(USER, NOW);
    expect(o.worlds.map((w) => w.id)).toEqual([1, 2]);
  });

  it('monde avec prérequis non terminé : verrouillé, IA verrouillées', async () => {
    const { service } = setup();
    const w2 = (await service.getOverview(USER, NOW)).worlds.find(
      (w) => w.id === 2,
    )!;
    expect(w2.unlocked).toBe(false);
    expect(w2.requires).toEqual([{ id: 1, name: 'Monde 1' }]);
    expect(w2.opponents.every((x) => x.state === 'locked')).toBe(true);
  });

  it('boss du prérequis battu : monde débloqué et monde 1 terminé', async () => {
    const ctx = setup();
    ctx.beat(1, 5);
    ctx.addMatch({ opponentId: 11 }); // farm
    const o = await ctx.service.getOverview(USER, NOW);
    const [w1, w2] = o.worlds;
    expect(w1.completed).toBe(true);
    expect(w1.beaten).toBe(5);
    expect(w1.opponents[0].wins).toBe(2);
    expect(w2.unlocked).toBe(true);
    expect(w2.opponents[0].state).toBe('available');
  });

  it('les combats orphelins (won null) et les défaites ne comptent pas', async () => {
    const ctx = setup();
    ctx.addMatch({ opponentId: 11, won: null, endedAt: null });
    ctx.addMatch({ opponentId: 11, won: false });
    const w1 = (await ctx.service.getOverview(USER, NOW)).worlds[0];
    expect(w1.opponents[0]).toMatchObject({ state: 'available', wins: 0 });
    expect(w1.opponents[1].state).toBe('locked');
  });

  it("fiche d'IA : récompenses, boss, portrait", async () => {
    const { service } = setup();
    const w1 = (await service.getOverview(USER, NOW)).worlds[0];
    const boss = w1.opponents[4];
    expect(boss).toMatchObject({
      id: 15,
      position: 5,
      level: 5,
      isBoss: true,
      portrait: { cardId: 505, imageUrl: '505.png' },
      firstWin: {
        gold: 500,
        xp: 300,
        boosterName: 'Booster 1',
        legendary: true,
      },
      farm: { gold: 60, xp: 40, boosterPct: 10, legendaryPct: 2 },
    });
    expect(w1.opponents[0]).toMatchObject({
      isBoss: false,
      firstWin: { legendary: false },
      farm: { legendaryPct: 0 },
    });
  });

  it('compteur de farm du jour et plafond réglé', async () => {
    const ctx = setup({ dailyCap: 5 });
    ctx.beat(1, 1);
    ctx.addMatch({ opponentId: 11, rewarded: true });
    ctx.addMatch({ opponentId: 11, rewarded: true });
    // hier (avant le reset) : ne compte pas
    ctx.addMatch({
      opponentId: 11,
      rewarded: true,
      endedAt: new Date(farmWindowStart(NOW).getTime() - 1000),
    });
    // plafonné : ne compte pas
    ctx.addMatch({ opponentId: 11, rewarded: false });
    const o = await ctx.service.getOverview(USER, NOW);
    expect(o.farmRewardsToday).toBe(2);
    expect(o.dailyCap).toBe(5);
  });
});

// ── prepareStart ────────────────────────────────────────────────────────────

describe('AdventureService.prepareStart', () => {
  it('IA 1 : crée le combat (won null) et renvoie deck + profil', async () => {
    const ctx = setup();
    const start = await ctx.service.prepareStart(USER, 11);
    expect(start).toMatchObject({
      opponentId: 11,
      opponentName: 'IA 1-1',
      profile: { archetype: 'pipou', level: 1 },
    });
    expect(start.aiCards).toHaveLength(30);
    expect(new Set(start.aiCards.map((c) => c.instanceId)).size).toBe(30);
    expect(ctx.matchRows).toEqual([
      expect.objectContaining({
        id: start.adventureMatchId,
        userId: USER,
        opponentId: 11,
        won: null,
      }),
    ]);
  });

  it('IA 2 sans avoir battu l’IA 1 : « IA verrouillée »', async () => {
    const ctx = setup();
    await expect(ctx.service.prepareStart(USER, 12)).rejects.toThrow(
      BadRequestException,
    );
    await expect(ctx.service.prepareStart(USER, 12)).rejects.toThrow(
      /IA verrouillée/,
    );
    expect(ctx.matchRows).toHaveLength(0);
  });

  it('IA 2 après un combat orphelin contre l’IA 1 : toujours verrouillée', async () => {
    const ctx = setup();
    ctx.addMatch({ opponentId: 11, won: null, endedAt: null });
    await expect(ctx.service.prepareStart(USER, 12)).rejects.toThrow(
      /IA verrouillée/,
    );
  });

  it('IA 2 après avoir battu l’IA 1 : autorisée, niveau 2', async () => {
    const ctx = setup();
    ctx.beat(1, 1);
    const start = await ctx.service.prepareStart(USER, 12);
    expect(start.profile.level).toBe(2);
  });

  it('IA introuvable', async () => {
    const ctx = setup();
    await expect(ctx.service.prepareStart(USER, 999)).rejects.toThrow(
      /IA introuvable/,
    );
  });

  it('monde inactif : erreur', async () => {
    const ctx = setup();
    await expect(ctx.service.prepareStart(USER, 31)).rejects.toThrow(
      BadRequestException,
    );
    expect(ctx.matchRows).toHaveLength(0);
  });

  it('monde verrouillé : erreur', async () => {
    const ctx = setup();
    await expect(ctx.service.prepareStart(USER, 21)).rejects.toThrow(
      /Monde verrouillé/,
    );
  });

  it('deck IA à 29 cartes : erreur', async () => {
    const w = world(1, {});
    (w.opponents as Row[])[0].cards = deck(10, 1000, 29);
    const ctx = setup({ worlds: [w] });
    await expect(ctx.service.prepareStart(USER, 11)).rejects.toThrow(
      /Deck de l'IA invalide.*29/,
    );
    expect(ctx.matchRows).toHaveLength(0);
  });
});

// ── recordResult ────────────────────────────────────────────────────────────

describe('AdventureService.recordResult', () => {
  it('1re victoire contre le boss : tout est crédité, monde terminé', async () => {
    const ctx = setup();
    ctx.beat(1, 4);
    const id = await startedMatch(ctx, 15);
    const r = await ctx.service.recordResult(game(USER), pve(id, 15), NOW);

    expect(ctx.users.addGold).toHaveBeenCalledWith(USER, 500, ctx.manager);
    expect(ctx.users.addExperience).toHaveBeenCalledWith(
      USER,
      300,
      ctx.manager,
    );
    expect(ctx.users.addBoosterToUser).toHaveBeenCalledWith(
      USER,
      100,
      1,
      ctx.manager,
    );
    expect(ctx.users.addCardToUser).toHaveBeenCalledWith(
      USER,
      900,
      1,
      ctx.manager,
    );
    expect(r).toEqual({
      opponentId: 15,
      worldId: 1,
      won: true,
      firstWin: true,
      worldCompleted: true,
      unlockedWorldIds: [2],
      loot: {
        gold: 500,
        xp: 300,
        boosters: [{ boosterId: 100, name: 'Booster 1', quantity: 1 }],
        cards: [
          {
            cardId: 900,
            name: 'Carte 900',
            rarity: Rarity.LEGENDARY,
            imageUrl: '900.png',
          },
        ],
        capped: false,
      },
    });
    const row = ctx.matchRows.find((m) => m.id === id)!;
    expect(row).toMatchObject({
      won: true,
      firstWin: true,
      rewarded: true,
      turns: 9,
      endReason: 'primes_depleted',
      loot: r.loot,
    });
    expect(row.endedAt).toBeInstanceOf(Date);
  });

  it('événements après le commit : adventure.finished et card.set.check', async () => {
    const ctx = setup();
    ctx.beat(1, 4);
    const id = await startedMatch(ctx, 15);
    await ctx.service.recordResult(game(USER), pve(id, 15), NOW);
    expect(ctx.events.emit).toHaveBeenCalledWith('adventure.finished', {
      userId: USER,
      won: true,
    });
    expect(ctx.events.emit).toHaveBeenCalledWith('card.set.check', {
      userId: USER,
      setId: 10,
    });
    expect(ctx.log.indexOf('commit')).toBeLessThan(
      ctx.log.indexOf('emit:adventure.finished'),
    );
  });

  it('1re victoire hors boss : booster, pas de légendaire, monde non terminé', async () => {
    const ctx = setup();
    const id = await startedMatch(ctx, 11);
    const r = await ctx.service.recordResult(game(USER), pve(id, 11), NOW);
    expect(ctx.users.addGold).toHaveBeenCalledWith(USER, 100, ctx.manager);
    expect(ctx.users.addBoosterToUser).toHaveBeenCalledTimes(1);
    expect(ctx.users.addCardToUser).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      firstWin: true,
      worldCompleted: false,
      unlockedWorldIds: [],
    });
    expect(ctx.events.emit).not.toHaveBeenCalledWith(
      'card.set.check',
      expect.anything(),
    );
  });

  it('2e victoire avec 20 farm payés aujourd’hui : plafonnée, aucun crédit', async () => {
    const ctx = setup();
    ctx.beat(1, 1);
    for (let i = 0; i < 20; i++)
      ctx.addMatch({ opponentId: 11, rewarded: true });
    const id = await startedMatch(ctx, 11);
    const r = await ctx.service.recordResult(game(USER), pve(id, 11), NOW);
    expect(r.won).toBe(true);
    expect(r.firstWin).toBe(false);
    expect(r.loot?.capped).toBe(true);
    expect(r.loot).toMatchObject({ gold: 0, xp: 0, boosters: [], cards: [] });
    expect(ctx.users.addGold).not.toHaveBeenCalled();
    expect(ctx.users.addExperience).not.toHaveBeenCalled();
    expect(ctx.users.addBoosterToUser).not.toHaveBeenCalled();
    expect(ctx.users.addCardToUser).not.toHaveBeenCalled();
    expect(ctx.matchRows.find((m) => m.id === id)).toMatchObject({
      won: true,
      firstWin: false,
      rewarded: false,
    });
    expect(ctx.events.emit).toHaveBeenCalledWith('adventure.finished', {
      userId: USER,
      won: true,
    });
  });

  it('farm sous le plafond : or/XP garantis, rewarded = true', async () => {
    const ctx = setup();
    ctx.beat(1, 1);
    ctx.addMatch({ opponentId: 11, won: null, endedAt: null }); // orphelin
    const id = await startedMatch(ctx, 11);
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // pas de booster
    try {
      const r = await ctx.service.recordResult(game(USER), pve(id, 11), NOW);
      expect(r.firstWin).toBe(false);
      expect(r.loot).toMatchObject({ gold: 15, xp: 10, boosters: [] });
      expect(ctx.users.addGold).toHaveBeenCalledWith(USER, 15, ctx.manager);
      expect(ctx.matchRows.find((m) => m.id === id)).toMatchObject({
        rewarded: true,
      });
      expect(await ctx.service.countFarmRewardsToday(USER, NOW)).toBe(1);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('défaite : aucun crédit, adventure.finished { won: false }', async () => {
    const ctx = setup();
    const id = await startedMatch(ctx, 11);
    const r = await ctx.service.recordResult(game(AI), pve(id, 11), NOW);
    expect(r).toEqual({
      opponentId: 11,
      worldId: 1,
      won: false,
      firstWin: false,
      loot: null,
      worldCompleted: false,
      unlockedWorldIds: [],
    });
    for (const fn of Object.values(ctx.users))
      expect(fn).not.toHaveBeenCalled();
    expect(ctx.events.emit).toHaveBeenCalledWith('adventure.finished', {
      userId: USER,
      won: false,
    });
    expect(ctx.matchRows.find((m) => m.id === id)).toMatchObject({
      won: false,
      rewarded: false,
      turns: 9,
    });
  });

  it('résultat déjà enregistré : refusé, rien de crédité deux fois', async () => {
    const ctx = setup();
    const id = await startedMatch(ctx, 11);
    await ctx.service.recordResult(game(USER), pve(id, 11), NOW);
    ctx.users.addGold.mockClear();
    ctx.events.emit.mockClear();
    await expect(
      ctx.service.recordResult(game(USER), pve(id, 11), NOW),
    ).rejects.toThrow();
    expect(ctx.users.addGold).not.toHaveBeenCalled();
    expect(ctx.events.emit).not.toHaveBeenCalled();
  });

  it('échec dans la transaction : aucun événement', async () => {
    const ctx = setup();
    const id = await startedMatch(ctx, 11);
    ctx.users.addGold.mockRejectedValueOnce(new Error('KO'));
    await expect(
      ctx.service.recordResult(game(USER), pve(id, 11), NOW),
    ).rejects.toThrow('KO');
    expect(ctx.events.emit).not.toHaveBeenCalled();
  });
});

describe('AdventureService.countFarmRewardsToday', () => {
  it('victoires de farm payées depuis le dernier reset seulement', async () => {
    const ctx = setup();
    ctx.addMatch({ opponentId: 11, firstWin: true, rewarded: true });
    ctx.addMatch({ opponentId: 11, rewarded: true });
    ctx.addMatch({ opponentId: 11, rewarded: true, userId: USER + 1 });
    ctx.addMatch({ opponentId: 11, won: false, rewarded: true });
    ctx.addMatch({
      opponentId: 11,
      rewarded: true,
      endedAt: new Date(farmWindowStart(NOW).getTime() - 1),
    });
    expect(await ctx.service.countFarmRewardsToday(USER, NOW)).toBe(1);
  });
});
