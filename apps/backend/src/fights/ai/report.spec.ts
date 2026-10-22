import type { AdventureArchetype } from '@pipou/shared';
import {
  alerts,
  formatDetail,
  formatMirror,
  formatSummary,
  wilson,
} from './report';
import { emptyTelemetry } from './telemetry';
import type { CardStats, DeckStats, Telemetry } from './telemetry';
import type { TournamentResult } from './tournament';

function card(
  name: string,
  archetype: AdventureArchetype,
  vs: AdventureArchetype,
  over: Partial<CardStats> = {},
): CardStats {
  return {
    card: name,
    archetype,
    vs,
    playedGames: 0,
    playedWins: 0,
    heldGames: 0,
    heldWins: 0,
    phasesInHand: 0,
    phasesPlayable: 0,
    phasesChosen: 0,
    blocked: { paiement: 0, zone: 0, cible: 0, condition: 0 },
    oppDestroyed: 0,
    primesTaken: 0,
    oppDiscarded: 0,
    oppBlocked: 0,
    ...over,
  };
}

function deck(
  archetype: AdventureArchetype,
  over: Partial<DeckStats> = {},
): DeckStats {
  return {
    name: `${archetype} niveau 1`,
    archetype,
    level: 1,
    mainPhases: 0,
    idlePhases: 0,
    idleReasons: { main_vide: 0, paiement: 0, zone: 0, cible: 0, condition: 0 },
    endReasons: {},
    turns: 0,
    games: 0,
    ...over,
  };
}

const strong = { playedGames: 40, playedWins: 30, heldGames: 40, heldWins: 12 };

function result(telemetry: Telemetry): TournamentResult {
  const cell = { wins: 50, played: 100 };
  const row = { pipou: cell, pixelman: cell, dragon: cell };
  return {
    games: 100,
    byEntry: [
      {
        name: 'pipou niveau 1',
        archetype: 'pipou',
        level: 1,
        wins: 5,
        played: 10,
      },
    ],
    byArchetype: { pipou: row, pixelman: row, dragon: row },
    telemetry,
  };
}

describe('wilson', () => {
  it('intervalle à 95 %', () => {
    const { low, high } = wilson(50, 100);
    expect(low).toBeCloseTo(0.404, 3);
    expect(high).toBeCloseTo(0.596, 3);
  });

  it('sans parties : tout est possible', () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe('alerts', () => {
  it('trop forte contre les deux autres', () => {
    const list = alerts({
      cards: [
        card('X', 'pipou', 'pixelman', strong),
        card('X', 'pipou', 'dragon', strong),
      ],
      decks: [],
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'trop_forte', subject: 'X' });
    expect(list[0].strength).toBeCloseTo(45);
  });

  it("pas d'alerte sous 30 parties", () => {
    const few = { ...strong, heldGames: 20 };
    expect(
      alerts({
        cards: [
          card('X', 'pipou', 'pixelman', few),
          card('X', 'pipou', 'dragon', few),
        ],
        decks: [],
      }),
    ).toEqual([]);
  });

  it('morte : jamais jouable', () => {
    const list = alerts({
      cards: [
        card('Y', 'dragon', 'pipou', { phasesInHand: 50, phasesPlayable: 5 }),
      ],
      decks: [],
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'morte', subject: 'Y' });
  });

  it('manque du deck', () => {
    const list = alerts({
      cards: [],
      decks: [
        deck('dragon', {
          mainPhases: 100,
          idlePhases: 40,
          idleReasons: {
            main_vide: 10,
            paiement: 0,
            zone: 0,
            cible: 30,
            condition: 0,
          },
        }),
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('manque_deck');
    expect(list[0].detail).toContain('cible');
    expect(list[0].strength).toBeCloseTo(15);
  });
});

describe('formatSummary', () => {
  it('le résumé tient en peu de lignes', () => {
    const dead = Array.from({ length: 50 }, (_, i) =>
      card(`Morte ${i}`, 'pipou', 'dragon', { phasesInHand: 40 }),
    );
    const text = formatSummary(result({ cards: dead, decks: [] }), 'rapide');
    const alertLines = text.split('\n').filter((l) => l.startsWith('- '));
    expect(alertLines.length).toBeLessThanOrEqual(10);
    expect(alertLines.length).toBeGreaterThan(0);
    expect(text).toContain('[');
  });

  it('le détail liste chaque carte et signale les données insuffisantes', () => {
    const text = formatDetail(
      result({
        cards: [card('Z', 'pixelman', 'pipou', { playedGames: 3 })],
        decks: [],
      }),
    );
    expect(text).toContain('| Z |');
    expect(text).toContain('données insuffisantes');
  });
});

describe('formatMirror', () => {
  const mirror = (rates: [number, number, number]): TournamentResult => {
    const archetypes: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];
    return {
      ...result(emptyTelemetry()),
      byEntry: archetypes.flatMap((archetype, i) => [
        {
          name: `${archetype} niveau 1 nouveau`,
          archetype,
          level: 1 as const,
          wins: rates[i],
          played: 100,
        },
        {
          name: `${archetype} niveau 1 ancien`,
          archetype,
          level: 1 as const,
          wins: 100 - rates[i],
          played: 100,
        },
      ]),
    };
  };

  it('critère atteint : 60 % partout et écart sous 10 points', () => {
    expect(formatMirror(mirror([70, 65, 62]))).toContain('critère atteint');
  });

  it('critère non atteint si un archétype progresse moins', () => {
    expect(formatMirror(mirror([70, 50, 62]))).toContain('critère non atteint');
  });
});
