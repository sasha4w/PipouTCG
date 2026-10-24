import { Logger } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { AdventureOpponent } from '../adventure/entities/adventure-opponent.entity';
import { RegenerateAdventureDecks1791000000010 } from './migrations/1791000000010-RegenerateAdventureDecks';
import { DrakonOriginesWorld1791000000015 } from './migrations/1791000000015-DrakonOriginesWorld';

/**
 * La prod rejoue les migrations à la suite (008 → 015) : une migration qui lit
 * `adventure_opponent` avec l'entité actuelle demanderait des colonnes qui
 * n'existent pas encore à son tour (farm_card_*, ajoutées en 014).
 */
function recorder() {
  const finds: { select?: Record<string, unknown> }[] = [];
  const manager = {
    find: (e: unknown, options: { select?: Record<string, unknown> }) => {
      if (e === AdventureOpponent) finds.push(options);
      return Promise.resolve([]);
    },
  };
  return { runner: { manager } as unknown as QueryRunner, finds };
}

describe('migrations : colonnes lues sur adventure_opponent', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['010', new RegenerateAdventureDecks1791000000010()],
    ['015', new DrakonOriginesWorld1791000000015()],
  ])('%s ne lit que des colonnes existantes à son tour', async (_n, m) => {
    const db = recorder();
    await m.up(db.runner);
    expect(db.finds.length).toBeGreaterThan(0);
    for (const options of db.finds) {
      expect(options.select).toBeDefined();
      expect(Object.keys(options.select!)).not.toEqual(
        expect.arrayContaining(['farmCardId']),
      );
      expect(Object.keys(options.select!)).not.toContain('farmCardPct');
      expect(Object.keys(options.select!)).not.toContain('farmCard');
    }
  });
});
