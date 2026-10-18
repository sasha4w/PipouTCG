import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RARITY_RANK, Rarity } from '@pipou/shared';
import type { DataSource } from 'typeorm';
import { Booster } from '../boosters/booster.entity';
import { CardSet } from '../card-sets/card-set.entity';
import { Card } from '../cards/card.entity';
import { allRealCards } from '../fights/testing/real-cards';
import type { UsersService } from '../users/users.service';
import { AdventureAdminService } from './adventure-admin.service';
import { AdventureService } from './adventure.service';
import { AdminOpponentDto } from './dto/admin-opponent.dto';
import { AdminSettingsDto } from './dto/admin-settings.dto';
import { AdminDeckDto } from './dto/admin-deck.dto';
import { AdminWorldDto } from './dto/admin-world.dto';
import { AdventureMatch } from './entities/adventure-match.entity';
import { AdventureOpponentCard } from './entities/adventure-opponent-card.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureSettings } from './entities/adventure-settings.entity';
import { AdventureWorld } from './entities/adventure-world.entity';

const SET_OF: Record<string, number> = { pipou: 1, pixelman: 2, dragon: 3 };
const SET_NAMES: Record<number, string> = {
  1: 'Pipou',
  2: 'SquareWorld',
  3: 'Drakon',
};
const BASE = allRealCards().filter((c) => c.archetype);

interface Row {
  id?: number;
  [k: string]: unknown;
}

function setup(opts?: { noLegendary?: number[] }) {
  const cards: Card[] = BASE.map((c) => {
    const setId = SET_OF[c.archetype as string];
    const rarity =
      opts?.noLegendary?.includes(setId) &&
      (c.rarity === Rarity.LEGENDARY || c.rarity === Rarity.SECRET)
        ? Rarity.EPIC
        : c.rarity;
    return { ...c, rarity, cardSet: { id: setId } } as unknown as Card;
  });
  const worlds: Row[] = [];
  const opponents: Row[] = [];
  const opponentCards: Row[] = [];
  const settings: Row[] = [];
  let nextId = 1;

  const cardById = (id: unknown) => cards.find((c) => c.id === id);
  const hydrateOpponent = (o: Row): Row => ({
    ...o,
    world: worlds.find((w) => w.id === o.worldId),
    cards: opponentCards
      .filter((c) => c.opponentId === o.id)
      .map((c) => ({ ...c, card: cardById(c.cardId) })),
  });
  const hydrateWorld = (w: Row): Row => ({
    ...w,
    cardSet: { id: w.cardSetId, name: SET_NAMES[w.cardSetId as number] },
    opponents: opponents.filter((o) => o.worldId === w.id).map(hydrateOpponent),
  });
  const setCards = (where: { cardSet: { id: number }; rarity?: string }) =>
    cards.filter(
      (c) =>
        (c.cardSet as unknown as { id: number }).id === where.cardSet.id &&
        (where.rarity === undefined || c.rarity === where.rarity),
    );

  const store = (entity: unknown): Row[] => {
    if (entity === AdventureWorld) return worlds;
    if (entity === AdventureOpponent) return opponents;
    if (entity === AdventureOpponentCard) return opponentCards;
    if (entity === AdventureSettings) return settings;
    throw new Error('entité inattendue');
  };

  const manager = {
    create: (_e: unknown, o: Row): Row => ({ ...o }),
    save: jest.fn((entity: unknown, data: Row | Row[]) => {
      const list = Array.isArray(data) ? data : [data];
      const rows = store(entity);
      for (const e of list) {
        const found =
          e.id === undefined ? undefined : rows.find((r) => r.id === e.id);
        if (found) Object.assign(found, e);
        else {
          if (e.id === undefined && entity !== AdventureSettings)
            e.id = nextId++;
          rows.push(e);
        }
      }
      return Promise.resolve(data);
    }),
    update: jest.fn((entity: unknown, where: Row, patch: Row) => {
      const row = store(entity).find((r) => r.id === where.id);
      if (row) Object.assign(row, patch);
      return Promise.resolve({ affected: row ? 1 : 0 });
    }),
    delete: jest.fn((entity: unknown, where: Row) => {
      const rows = store(entity);
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i].opponentId === where.opponentId) rows.splice(i, 1);
      return Promise.resolve();
    }),
    find: jest.fn((entity: unknown, o?: { where?: Row }) => {
      if (entity === AdventureWorld)
        return Promise.resolve(worlds.map(hydrateWorld));
      if (entity === Card)
        return Promise.resolve(
          setCards(o!.where as { cardSet: { id: number } }),
        );
      throw new Error('find inattendu');
    }),
    findOne: jest.fn((entity: unknown, o: { where: Row }) => {
      const w = o.where;
      if (entity === AdventureWorld) {
        const hit = worlds.find((r) =>
          Object.entries(w).every(([k, v]) => r[k] === v),
        );
        return Promise.resolve(hit ? hydrateWorld(hit) : null);
      }
      if (entity === AdventureOpponent) {
        const hit = opponents.find((r) => r.id === w.id);
        return Promise.resolve(hit ? hydrateOpponent(hit) : null);
      }
      if (entity === CardSet)
        return Promise.resolve(
          SET_NAMES[w.id as number]
            ? { id: w.id, name: SET_NAMES[w.id as number] }
            : null,
        );
      if (entity === Booster) {
        // Booster n*10+1 appartient au set n ; 999 n'existe pas.
        const sid = (w.cardSet as { id: number } | undefined)?.id;
        const owner = Math.floor((w.id as number) / 10);
        return Promise.resolve(
          w.id === 999 || (sid !== undefined && sid !== owner)
            ? null
            : { id: w.id },
        );
      }
      if (entity === Card) {
        const c = cardById(w.id);
        const sid = (w.cardSet as { id: number } | undefined)?.id;
        return Promise.resolve(
          c &&
            (sid === undefined ||
              (c.cardSet as unknown as { id: number }).id === sid)
            ? c
            : null,
        );
      }
      if (entity === AdventureSettings)
        return Promise.resolve(settings.find((s) => s.id === w.id) ?? null);
      throw new Error('findOne inattendu');
    }),
    count: jest.fn((entity: unknown, o: { where: never }) => {
      if (entity === AdventureMatch) return Promise.resolve(0);
      if (entity !== Card) throw new Error('count inattendu');
      return Promise.resolve(setCards(o.where).length);
    }),
    createQueryBuilder: jest.fn(() => {
      const qb = {
        innerJoin: () => qb,
        select: () => qb,
        addSelect: () => qb,
        where: () => qb,
        andWhere: () => qb,
        groupBy: () => qb,
        addGroupBy: () => qb,
        getRawMany: () => Promise.resolve([]),
      };
      return qb;
    }),
  };
  const dataSource = {
    manager,
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  };
  const service = new AdventureAdminService(
    dataSource as unknown as DataSource,
  );
  let t = 0.123;
  service.random = () => (t = (t * 9301 + 0.49297) % 1);
  return { service, dataSource, worlds, opponents, opponentCards, settings };
}

const worldBody = (over: Record<string, unknown> = {}) => ({
  name: 'Mon monde',
  cardSetId: 1,
  // Booster du set : set n -> booster n*10+1
  boosterId: ((over.cardSetId as number | undefined) ?? 1) * 10 + 1,
  order: 1,
  isActive: false,
  prerequisiteIds: [] as number[],
  ...over,
});

const deckSize = (rows: Row[], opponentId: unknown) =>
  rows
    .filter((r) => r.opponentId === opponentId)
    .reduce((s, r) => s + (r.quantity as number), 0);

async function rejects(p: Promise<unknown>, message: string | RegExp) {
  await expect(p).rejects.toBeInstanceOf(BadRequestException);
  await expect(p).rejects.toThrow(message);
}

describe('AdventureAdminService.createWorld', () => {
  it('génère 5 IA avec decks valides, signature = archétype majoritaire du set', async () => {
    const { service, worlds, opponents, opponentCards } = setup();
    const w = await service.createWorld(worldBody({ cardSetId: 3 }));
    expect(worlds).toHaveLength(1);
    expect(w.cardSetName).toBe('Drakon');
    expect(w.opponents.map((o) => o.position)).toEqual([1, 2, 3, 4, 5]);
    expect(opponents).toHaveLength(5);
    for (const o of opponents) {
      const size = deckSize(opponentCards, o.id);
      expect(size).toBeGreaterThanOrEqual(30);
      expect(size).toBeLessThanOrEqual(40);
      expect(JSON.parse(o.signature as string)).toMatchObject({
        archetype: 'dragon',
      });
    }
    expect(w.opponents.every((o) => o.deckError === null)).toBe(true);
  });

  it('carte signature : la rareté ne décroît pas avec le niveau, le boss est la plus rare', async () => {
    const { service } = setup();
    const w = await service.createWorld(worldBody());
    const ranks = w.opponents.map((o) => {
      const card = BASE.find((c) => c.id === o.portraitCardId)!;
      return RARITY_RANK[card.rarity];
    });
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const max = Math.max(
      ...BASE.filter((c) => c.archetype === 'pipou').map(
        (c) => RARITY_RANK[c.rarity],
      ),
    );
    expect(ranks[4]).toBe(max);
  });

  it('actif demandé sur un set sans légendaire : 400 avec la raison, rien de persisté', async () => {
    const { service, worlds, opponents } = setup({ noLegendary: [1] });
    await rejects(
      service.createWorld(worldBody({ isActive: true })),
      'Aucune carte légendaire dans le set',
    );
    expect(worlds).toHaveLength(0);
    expect(opponents).toHaveLength(0);
  });

  it('set sans légendaire mais inactif : accepté, raison d inactivité exposée', async () => {
    const { service } = setup({ noLegendary: [1] });
    const w = await service.createWorld(worldBody());
    expect(w.isActive).toBe(false);
    expect(w.inactiveReason).toBe('Aucune carte légendaire dans le set');
  });

  it('refuse un 2e monde pour le même set, un set ou un booster inconnu', async () => {
    const { service } = setup();
    const first = await service.createWorld(worldBody());
    await rejects(service.createWorld(worldBody()), /existe déjà/);
    await rejects(
      service.createWorld(worldBody({ cardSetId: 42 })),
      /Set introuvable/,
    );
    await rejects(
      service.createWorld(worldBody({ cardSetId: 2, boosterId: 999 })),
      /Booster introuvable/,
    );
    await rejects(
      service.createWorld(worldBody({ cardSetId: 2, boosterId: 11 })),
      'Le booster doit appartenir au set du monde',
    );
    await rejects(
      service.updateWorld(first.id, worldBody({ boosterId: 21 })),
      'Le booster doit appartenir au set du monde',
    );
  });
});

describe('AdventureAdminService.updateWorld', () => {
  it('refuse l activation d un monde sans légendaire (raison de canActivateWorld)', async () => {
    const { service } = setup({ noLegendary: [1] });
    const w = await service.createWorld(worldBody());
    await rejects(
      service.updateWorld(w.id, worldBody({ isActive: true })),
      'Aucune carte légendaire dans le set',
    );
  });

  it('active un monde valide et enregistre les champs', async () => {
    const { service } = setup();
    const w = await service.createWorld(worldBody());
    const u = await service.updateWorld(
      w.id,
      worldBody({ isActive: true, name: 'Renommé', order: 7 }),
    );
    expect(u).toMatchObject({ isActive: true, name: 'Renommé', order: 7 });
  });

  it('refuse de changer le set d un monde', async () => {
    const { service } = setup();
    const w = await service.createWorld(worldBody());
    await rejects(
      service.updateWorld(w.id, worldBody({ cardSetId: 2 })),
      /set/i,
    );
  });

  it('prérequis : refuse soi-même', async () => {
    const { service } = setup();
    const a = await service.createWorld(worldBody());
    await rejects(
      service.updateWorld(a.id, worldBody({ prerequisiteIds: [a.id] })),
      /propre prérequis/,
    );
  });

  it('prérequis : refuse un cycle A→B→A', async () => {
    const { service } = setup();
    const a = await service.createWorld(worldBody());
    const b = await service.createWorld(worldBody({ cardSetId: 2, order: 2 }));
    const ok = await service.updateWorld(
      b.id,
      worldBody({ cardSetId: 2, order: 2, prerequisiteIds: [a.id] }),
    );
    expect(ok.prerequisiteIds).toEqual([a.id]);
    await rejects(
      service.updateWorld(a.id, worldBody({ prerequisiteIds: [b.id] })),
      /cycle/,
    );
  });

  it('prérequis : refuse un cycle indirect A→B→C→A et un monde inconnu', async () => {
    const { service } = setup();
    const a = await service.createWorld(worldBody());
    const b = await service.createWorld(worldBody({ cardSetId: 2 }));
    const c = await service.createWorld(worldBody({ cardSetId: 3 }));
    await service.updateWorld(
      b.id,
      worldBody({ cardSetId: 2, prerequisiteIds: [a.id] }),
    );
    await service.updateWorld(
      c.id,
      worldBody({ cardSetId: 3, prerequisiteIds: [b.id] }),
    );
    await rejects(
      service.updateWorld(a.id, worldBody({ prerequisiteIds: [c.id] })),
      /cycle/,
    );
    await rejects(
      service.updateWorld(a.id, worldBody({ prerequisiteIds: [77] })),
      /introuvable/,
    );
  });

  it('création : prérequis inconnu refusé', async () => {
    const { service } = setup();
    await rejects(
      service.createWorld(worldBody({ prerequisiteIds: [77] })),
      /introuvable/,
    );
  });
});

describe('AdventureAdminService.updateOpponent', () => {
  const body = (over: Record<string, unknown> = {}) => ({
    name: 'Nouveau nom',
    quote: 'Nouvelle réplique',
    portraitCardId: BASE.find((c) => c.archetype === 'pipou')!.id,
    firstWinGold: 10,
    firstWinXp: 20,
    farmGold: 1,
    farmXp: 2,
    farmBoosterPct: 12.5,
    farmLegendaryPct: 0,
    ...over,
  });

  it('met à jour identité et récompenses', async () => {
    const { service, opponents } = setup();
    const w = await service.createWorld(worldBody());
    const id = w.opponents[0].id;
    const u = await service.updateOpponent(id, body());
    expect(u.opponents[0]).toMatchObject({
      name: 'Nouveau nom',
      firstWinGold: 10,
      farmBoosterPct: 12.5,
    });
    expect(opponents.find((o) => o.id === id)).toMatchObject({
      quote: 'Nouvelle réplique',
    });
  });

  it('portrait d un autre set : 400', async () => {
    const { service } = setup();
    const w = await service.createWorld(worldBody());
    const other = BASE.find((c) => c.archetype === 'dragon')!.id;
    await rejects(
      service.updateOpponent(
        w.opponents[0].id,
        body({ portraitCardId: other }),
      ),
      /portrait/i,
    );
  });
});

describe('AdventureAdminService.updateDeck', () => {
  const pipou = BASE.filter((c) => c.archetype === 'pipou');
  const cardsOf = (n: number) => {
    const out: { cardId: number; quantity: number }[] = [];
    let left = n;
    for (const c of pipou) {
      const q = Math.min(3, left);
      if (q <= 0) break;
      out.push({ cardId: c.id, quantity: q });
      left -= q;
    }
    return out;
  };

  it('deck de 30 cartes du set : persisté', async () => {
    const { service, opponentCards } = setup();
    const w = await service.createWorld(worldBody());
    const id = w.opponents[1].id;
    const u = await service.updateDeck(id, { cards: cardsOf(30) });
    expect(u.opponents[1].deckSize).toBe(30);
    expect(deckSize(opponentCards, id)).toBe(30);
  });

  it('deck de 29 cartes : 400', async () => {
    const { service, opponentCards } = setup();
    const w = await service.createWorld(worldBody());
    const id = w.opponents[0].id;
    const before = deckSize(opponentCards, id);
    await rejects(
      service.updateDeck(id, { cards: cardsOf(29) }),
      /entre 30 et 40/,
    );
    expect(deckSize(opponentCards, id)).toBe(before);
  });

  it('carte d un autre set : 400', async () => {
    const { service } = setup();
    const w = await service.createWorld(worldBody());
    const cards = cardsOf(30);
    cards[0] = {
      cardId: BASE.find((c) => c.archetype === 'dragon')!.id,
      quantity: 3,
    };
    await rejects(
      service.updateDeck(w.opponents[0].id, { cards }),
      /n'appartient pas au set/,
    );
  });

  it('plus de 3 exemplaires (doublon fusionné) : 400', async () => {
    const { service } = setup();
    const w = await service.createWorld(worldBody());
    const cards = [...cardsOf(30), { cardId: pipou[0].id, quantity: 2 }];
    await rejects(
      service.updateDeck(w.opponents[0].id, { cards }),
      /Maximum 3 exemplaires/,
    );
  });
});

describe('AdventureAdminService.regenerateDeck', () => {
  it('persiste un nouveau deck valide et différent', async () => {
    const { service, opponentCards } = setup();
    const w = await service.createWorld(worldBody());
    const id = w.opponents[2].id;
    const snapshot = (): string =>
      JSON.stringify(
        opponentCards
          .filter((r) => r.opponentId === id)
          .map((r) => [r.cardId, r.quantity])
          .sort(),
      );
    const before = snapshot();
    const u = await service.regenerateDeck(id);
    const after = snapshot();
    expect(after).not.toBe(before);
    expect(u.opponents[2].deckError).toBeNull();
    expect(deckSize(opponentCards, id)).toBe(u.opponents[2].deckSize);
    expect(u.opponents[2].deckSize).toBeGreaterThanOrEqual(30);
  });

  it('IA inconnue : 404', async () => {
    const { service } = setup();
    await expect(service.regenerateDeck(404)).rejects.toThrow(/introuvable/);
  });
});

describe('AdventureAdminService overview + settings', () => {
  it('liste tous les mondes (actifs ou non) avec decks et dailyCap', async () => {
    const { service } = setup();
    await service.createWorld(worldBody());
    await service.createWorld(worldBody({ cardSetId: 2, isActive: true }));
    const o = await service.getOverview();
    expect(o.worlds.map((w) => w.isActive)).toEqual([false, true]);
    expect(o.worlds[0].opponents[0].deck.length).toBeGreaterThan(0);
    expect(o.worlds[0].opponents[0]).toHaveProperty('deck.0.name');
    expect(o.dailyCap).toBe(20);
  });

  it('dailyCap 25 : lu par le service joueur (plafond de farm)', async () => {
    const { service, dataSource } = setup();
    const r = await service.updateSettings({ dailyCap: 25 });
    expect(r).toEqual({ dailyCap: 25 });
    const player = new AdventureService(
      dataSource as unknown as DataSource,
      {} as UsersService,
      {} as EventEmitter2,
    );
    const overview = await player.getOverview(1);
    expect(overview.dailyCap).toBe(25);
    expect((await service.getOverview()).dailyCap).toBe(25);
    await service.updateSettings({ dailyCap: 0 });
    expect((await service.getOverview()).dailyCap).toBe(0);
  });
});

describe('DTOs admin', () => {
  const errs = async (cls: new () => object, plain: object) =>
    validate(plainToInstance(cls, plain)).then((e) => e.length);

  it('settings : entier 0..1000', async () => {
    expect(await errs(AdminSettingsDto, { dailyCap: 1000 })).toBe(0);
    expect(await errs(AdminSettingsDto, { dailyCap: 1001 })).toBe(1);
    expect(await errs(AdminSettingsDto, { dailyCap: -1 })).toBe(1);
    expect(await errs(AdminSettingsDto, { dailyCap: 1.5 })).toBe(1);
  });

  it('opponent : pourcentages 0..100, montants >= 0', async () => {
    const ok = {
      name: 'a',
      quote: 'b',
      portraitCardId: 1,
      firstWinGold: 0,
      firstWinXp: 0,
      farmGold: 0,
      farmXp: 0,
      farmBoosterPct: 100,
      farmLegendaryPct: 0,
    };
    expect(await errs(AdminOpponentDto, ok)).toBe(0);
    expect(await errs(AdminOpponentDto, { ...ok, farmBoosterPct: 100.5 })).toBe(
      1,
    );
    expect(await errs(AdminOpponentDto, { ...ok, farmLegendaryPct: -1 })).toBe(
      1,
    );
    expect(await errs(AdminOpponentDto, { ...ok, farmGold: -1 })).toBe(1);
    expect(await errs(AdminOpponentDto, { ...ok, name: '' })).toBe(1);
  });

  it('deck et monde : structure validée', async () => {
    expect(
      await errs(AdminDeckDto, { cards: [{ cardId: 1, quantity: 0 }] }),
    ).toBe(1);
    expect(
      await errs(AdminDeckDto, { cards: [{ cardId: 1, quantity: 2 }] }),
    ).toBe(0);
    expect(await errs(AdminWorldDto, worldBody())).toBe(0);
    expect(
      await errs(AdminWorldDto, worldBody({ prerequisiteIds: ['x'] })),
    ).toBe(1);
  });
});
