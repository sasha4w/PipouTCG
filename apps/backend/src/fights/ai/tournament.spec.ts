import type { AdventureArchetype } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { generateDeck } from '../../adventure/deck-generator';
import { LAUNCH_SIGNATURES } from '../../adventure/signatures';
import { allRealCards } from '../testing/real-cards';
import {
  formatTournament,
  planGames,
  playPlanned,
  runTournament,
} from './tournament';
import type { TournamentEntry } from './tournament';

jest.setTimeout(120_000);

const ALL = allRealCards();

function entryFor(
  name: string,
  archetype: AdventureArchetype,
): TournamentEntry {
  const set = ALL.filter((c) => c.archetype === archetype);
  const byId = new Map<number, Card>(set.map((c) => [c.id, c]));
  const deck = generateDeck(
    set,
    3,
    LAUNCH_SIGNATURES[archetype][2],
    () => 0.5,
  ).flatMap((e) =>
    Array.from({ length: e.quantity }, () => byId.get(e.cardId)!),
  );
  return { name, archetype, level: 3, deck };
}

describe('runTournament', () => {
  const entries = [
    entryFor('Pipou 3', 'pipou'),
    entryFor('Dragon 3', 'dragon'),
  ];

  it('joue les parties demandées, sans nul compté comme victoire', () => {
    const result = runTournament(entries, 2, 1);
    expect(result.games).toBe(2);
    for (const e of result.byEntry) expect(e.played).toBe(2);
    const wins = result.byEntry.reduce((n, e) => n + e.wins, 0);
    expect(wins).toBeLessThanOrEqual(2);
    expect(
      result.byArchetype.pipou.dragon.played +
        result.byArchetype.dragon.pipou.played,
    ).toBe(4);
  });

  it("alterne les places (p1/p2) d'une même paire", () => {
    const seats: string[] = [];
    runTournament(entries, 4, 1, (game) => seats.push(game.p1));
    expect(seats.filter((s) => s === 'Pipou 3')).toHaveLength(2);
    expect(seats.filter((s) => s === 'Dragon 3')).toHaveLength(2);
  });

  it("planGames reproduit l'ordre et les graines", () => {
    const games = planGames(entries, 4, 1);
    expect(games.map((g) => g.seed)).toEqual([1, 7920, 15839, 23758]);
    expect(games.map((g) => g.p1)).toEqual([0, 1, 0, 1]);
  });

  it('la télémétrie couvre les deux decks', () => {
    const { telemetry } = runTournament(entries, 2, 1);
    expect(telemetry.decks).toHaveLength(2);
    for (const d of telemetry.decks) expect(d.games).toBe(2);
    const seen = telemetry.cards.reduce(
      (n, c) => n + c.playedGames + c.heldGames,
      0,
    );
    expect(seen).toBeGreaterThan(0);
  });

  it('déterministe', () => {
    expect(runTournament(entries, 2, 1).telemetry).toEqual(
      runTournament(entries, 2, 1).telemetry,
    );
  });

  it("une partie sans vainqueur n'est pas une victoire", () => {
    const result = playPlanned(entries, planGames(entries, 1, 1), {
      maxActions: 5,
    });
    expect(result.games).toBe(1);
    expect(result.byEntry.reduce((n, e) => n + e.wins, 0)).toBe(0);
    expect(result.telemetry.cards.every((c) => c.playedWins === 0)).toBe(true);
    expect(result.telemetry.cards.every((c) => c.heldWins === 0)).toBe(true);
  });

  it('formate un tableau markdown', () => {
    const text = formatTournament(runTournament(entries, 2, 1));
    expect(text).toContain('| Pipou 3');
    expect(text).toContain('pipou');
  });
});
