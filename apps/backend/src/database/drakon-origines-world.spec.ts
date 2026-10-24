import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { AdventureOpponent } from '../adventure/entities/adventure-opponent.entity';
import { AdventureOpponentCard } from '../adventure/entities/adventure-opponent-card.entity';
import { Card } from '../cards/card.entity';
import { allRealCards } from '../fights/testing/real-cards';
import { DrakonOriginesWorld1791000000015 } from './migrations/1791000000015-DrakonOriginesWorld';

type Row = Record<string, unknown>;
const CARDS = allRealCards();
const id = (name: string) => CARDS.find((c) => c.name === name)!.id;

function dragonWorld(): Row[] {
  const world = { id: 3, cardSetId: 30 };
  const sigs = [
    { archetype: 'dragon', cardName: 'Adulte Teros', element: 'earth' },
    { archetype: 'dragon', cardName: 'Adulte Feros', element: 'fire' },
    { archetype: 'dragon', cardName: 'Adulte Ackos', element: 'water' },
    { archetype: 'dragon', cardName: 'Adulte Tempestu', element: 'wind' },
    { archetype: 'dragon', cardName: 'Œuf Céleste' },
  ];
  return sigs.map((s, i) => ({
    id: 30 + i + 1,
    position: i + 1,
    world,
    signature: JSON.stringify(s),
    portraitCardId: id(s.cardName),
    farmCardId: null,
    farmCardPct: 0,
  }));
}

function fakeManager(opponents: Row[]) {
  const updates: [number, Row][] = [];
  const saved: Row[][] = [];
  const manager = {
    find: (e: unknown) => {
      if (e === AdventureOpponent) return Promise.resolve(opponents);
      if (e === Card) return Promise.resolve(CARDS);
      throw new Error('find inattendu');
    },
    update: (e: unknown, where: { id: number }, set: Row) => {
      if (e !== AdventureOpponent) throw new Error('update inattendu');
      updates.push([where.id, set]);
      Object.assign(
        opponents.find((o) => o.id === where.id)!,
        set,
      );
      return Promise.resolve();
    },
    delete: (e: unknown) => {
      if (e !== AdventureOpponentCard) throw new Error('delete inattendu');
      return Promise.resolve();
    },
    create: (_e: unknown, row: Row) => row,
    save: (_e: unknown, rows: Row[]) => {
      saved.push(rows);
      return Promise.resolve(rows);
    },
  };
  return {
    runner: { manager } as unknown as QueryRunner,
    updates,
    saved,
  };
}

const migration = new DrakonOriginesWorld1791000000015();

describe('migration DrakonOriginesWorld', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('boss des Origines, Ancestral par élément, decks régénérés', async () => {
    const opponents = dragonWorld();
    const db = fakeManager(opponents);
    await migration.up(db.runner);
    const boss = opponents[4];
    expect(JSON.parse(boss.signature as string)).toEqual({
      archetype: 'dragon',
      cardName: 'Drakon des Origines',
    });
    expect(boss).toMatchObject({
      portraitCardId: id('Drakon des Origines'),
      farmCardId: id('Drakon des Origines'),
      farmCardPct: 1,
    });
    const expected = [
      'Ancestral Teros',
      'Ancestral Feros',
      'Ancestral Ackos',
      'Ancestral Tempestu',
    ];
    expected.forEach((name, i) =>
      expect(opponents[i]).toMatchObject({
        farmCardId: id(name),
        farmCardPct: 5,
      }),
    );
    expect(db.saved).toHaveLength(5);
  });

  it('sans monde Drakon : aucune écriture', async () => {
    const pipou = [
      {
        id: 1,
        position: 1,
        world: { id: 1, cardSetId: 10 },
        signature: JSON.stringify({ archetype: 'pipou', cardName: 'X' }),
      },
    ];
    const db = fakeManager(pipou);
    await expect(migration.up(db.runner)).resolves.toBeUndefined();
    expect(db.updates).toHaveLength(0);
    expect(db.saved).toHaveLength(0);
  });

  it('rejouée : même état', async () => {
    const opponents = dragonWorld();
    const db = fakeManager(opponents);
    await migration.up(db.runner);
    const once = opponents.map(
      ({ signature, portraitCardId, farmCardId, farmCardPct }) => ({
        signature,
        portraitCardId,
        farmCardId,
        farmCardPct,
      }),
    );
    await migration.up(db.runner);
    expect(
      opponents.map(
        ({ signature, portraitCardId, farmCardId, farmCardPct }) => ({
          signature,
          portraitCardId,
          farmCardId,
          farmCardPct,
        }),
      ),
    ).toEqual(once);
  });

  it('down : boss de l’Œuf Céleste, plus de carte de farm', async () => {
    const opponents = dragonWorld();
    const db = fakeManager(opponents);
    await migration.up(db.runner);
    await migration.down(db.runner);
    expect(JSON.parse(opponents[4].signature as string)).toEqual({
      archetype: 'dragon',
      cardName: 'Œuf Céleste',
    });
    expect(opponents[4].portraitCardId).toBe(id('Œuf Céleste'));
    for (const o of opponents)
      expect(o).toMatchObject({ farmCardId: null, farmCardPct: 0 });
  });
});
