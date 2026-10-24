import { randomUUID } from 'node:crypto';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { createGameState } from '../helpers/game-factory';
import type { CardInstance } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { AiPlayer, aiMustAct } from './ai-player';
import { STRONGEST } from './planner';
import type { ThinkingProfile } from './planner';
import type { AiLevel } from './ai-player';
import { LEVEL_BRAINS } from './level-brains';
import type { LevelBrain } from './level-brains';
import { GameRecorder, emptyTelemetry, mergeTelemetry } from './telemetry';
import type { Telemetry } from './telemetry';

/** Garde-fou : une partie qui dépasse ce nombre d'actions n'a pas de vainqueur. */
export const MAX_ACTIONS = 2000;

/**
 * Cerveau d'une entrée de tournoi. Jamais de plafond de temps : il
 * dépend de la machine et rendrait le tournoi non reproductible.
 */
export function brainOf(e: TournamentEntry): LevelBrain {
  if (e.brain === 'plan')
    return { thinking: { ...STRONGEST, ...e.thinking }, mistakeRate: 0 };
  if (e.brain === 'level') {
    const { thinking, mistakeRate } = LEVEL_BRAINS[e.level];
    if (thinking === 'greedy') return { thinking, mistakeRate };
    const { timeLimitMs: _untimed, ...budgetOnly } = thinking;
    return { thinking: budgetOnly, mistakeRate };
  }
  return { thinking: 'greedy', mistakeRate: 0 };
}

/** Glouton sans erreur, le plus fort (`plan`), ou le cerveau d'aventure du niveau. */
export type Brain = 'greedy' | 'plan' | 'level';

export interface TournamentEntry {
  name: string;
  archetype: AdventureArchetype;
  level: AiLevel;
  /** Une entrée par exemplaire. */
  deck: Card[];
  /** Cerveau : glouton par défaut. */
  brain?: Brain;
  /** Réglage du planificateur, par-dessus STRONGEST. */
  thinking?: Partial<ThinkingProfile>;
}

export interface TournamentResult {
  games: number;
  byEntry: {
    name: string;
    archetype: AdventureArchetype;
    level: AiLevel;
    wins: number;
    played: number;
  }[];
  byArchetype: Record<
    AdventureArchetype,
    Record<AdventureArchetype, { wins: number; played: number }>
  >;
  telemetry: Telemetry;
}

/** Partie à jouer : indices dans `entries` et graine. */
export interface PlannedGame {
  /** Paire (i < j), pour les compteurs. */
  i: number;
  j: number;
  /** Places de la partie. */
  p1: number;
  p2: number;
  seed: number;
}

const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];

/** mulberry32 : générateur déterministe. */
export function seeded(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Instancie et mélange le deck (le moteur ne mélange pas : fixedRng). */
function instances(
  deck: Card[],
  ownerId: number,
  random: () => number,
): CardInstance[] {
  const cards = deck.map((baseCard) => ({
    instanceId: randomUUID(),
    baseCard,
    ownerId,
  }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Joue une partie : vainqueur (0 = p1, 1 = p2, null sans vainqueur) et télémétrie. */
function playGame(
  p1: TournamentEntry,
  p2: TournamentEntry,
  seed: number,
  maxActions: number,
): { winner: 0 | 1 | null; telemetry: Telemetry } {
  const random = seeded(seed);
  // PickService mélange avec Math.random : on le fige pendant la partie
  const realRandom = Math.random;
  Math.random = seeded(seed ^ 0x9e3779b9);
  try {
    const engine = createEngine(fixedRng());
    const aiFor = (e: TournamentEntry) => {
      const { thinking, mistakeRate } = brainOf(e);
      return new AiPlayer(engine, random, thinking, mistakeRate);
    };
    const ais: Record<Seat, AiPlayer> = { p1: aiFor(p1), p2: aiFor(p2) };
    const game = createGameState(
      1,
      { userId: 1, username: p1.name, socketId: 's1' },
      { userId: 2, username: p2.name, socketId: 's2' },
    );
    engine.setupDeck(game, 'p1', instances(p1.deck, 1, random));
    engine.setupDeck(game, 'p2', instances(p2.deck, 2, random));
    const seats: { seat: Seat; userId: number; entry: TournamentEntry }[] = [
      { seat: 'p1', userId: 1, entry: p1 },
      { seat: 'p2', userId: 2, entry: p2 },
    ];
    const recorder = new GameRecorder({ p1, p2 });
    let actions = 0;
    while (game.phase !== 'finished' && actions < maxActions) {
      const actor = seats.find((s) => aiMustAct(game, s.userId));
      if (!actor) break;
      const { action, valid } = ais[actor.seat].chooseDetailed(
        game,
        actor.seat,
        {
          archetype: actor.entry.archetype,
          level: actor.entry.level,
        },
      );
      recorder.beforeAction(game, actor.seat, valid, action);
      engine.dispatch(game, actor.seat, action);
      recorder.afterAction(game);
      actions++;
    }
    const finished = game.phase === 'finished';
    const winner =
      finished && game.winner === 1
        ? 0
        : finished && game.winner === 2
          ? 1
          : null;
    const seat = winner === 0 ? 'p1' : winner === 1 ? 'p2' : null;
    return { winner, telemetry: recorder.finish(game, seat) };
  } finally {
    Math.random = realRandom;
  }
}

/**
 * Tournoi toutes paires : chaque paire non ordonnée joue `gamesPerPair`
 * parties, les places p1/p2 alternant. `onGame` (optionnel) observe chaque
 * partie avant qu'elle soit jouée (noms des joueurs en p1 et p2).
 */
export function runTournament(
  entries: TournamentEntry[],
  gamesPerPair: number,
  seed: number,
  onGame?: (game: { p1: string; p2: string }) => void,
): TournamentResult {
  const planned = planGames(entries, gamesPerPair, seed);
  for (const g of planned)
    onGame?.({ p1: entries[g.p1].name, p2: entries[g.p2].name });
  return playPlanned(entries, planned);
}

/**
 * Parties de toutes les paires non ordonnées, `gamesPerPair` chacune, places
 * alternées ; la graine d'une partie dépend de son rang dans ce plan.
 */
export function planGames(
  entries: TournamentEntry[],
  gamesPerPair: number,
  seed: number,
): PlannedGame[] {
  const out: PlannedGame[] = [];
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++)
      for (let g = 0; g < gamesPerPair; g++) {
        const [p1, p2] = g % 2 === 0 ? [i, j] : [j, i];
        out.push({ i, j, p1, p2, seed: seed + out.length * 7919 });
      }
  return out;
}

function emptyResult(entries: TournamentEntry[]): TournamentResult {
  return {
    games: 0,
    byEntry: entries.map((e) => ({
      name: e.name,
      archetype: e.archetype,
      level: e.level,
      wins: 0,
      played: 0,
    })),
    byArchetype: Object.fromEntries(
      ARCHETYPES.map((a) => [
        a,
        Object.fromEntries(ARCHETYPES.map((b) => [b, { wins: 0, played: 0 }])),
      ]),
    ) as TournamentResult['byArchetype'],
    telemetry: emptyTelemetry(),
  };
}

/** Joue les parties planifiées et cumule victoires et télémétrie. */
export function playPlanned(
  entries: TournamentEntry[],
  planned: PlannedGame[],
  opts: { maxActions?: number } = {},
): TournamentResult {
  const result = emptyResult(entries);
  const { byEntry, byArchetype } = result;
  for (const g of planned) {
    const { winner, telemetry } = playGame(
      entries[g.p1],
      entries[g.p2],
      g.seed,
      opts.maxActions ?? MAX_ACTIONS,
    );
    const [a, b, i, j] = [g.p1, g.p2, g.i, g.j];
    result.games++;
    byEntry[i].played++;
    byEntry[j].played++;
    byArchetype[entries[i].archetype][entries[j].archetype].played++;
    byArchetype[entries[j].archetype][entries[i].archetype].played++;
    if (winner !== null) {
      const w = winner === 0 ? a : b;
      const l = w === a ? b : a;
      byEntry[w].wins++;
      byArchetype[entries[w].archetype][entries[l].archetype].wins++;
    }
    result.telemetry = mergeTelemetry(result.telemetry, telemetry);
  }
  return result;
}

/** Somme de deux résultats (decks rapprochés par nom). */
export function mergeResults(
  a: TournamentResult,
  b: TournamentResult,
): TournamentResult {
  const byEntry = a.byEntry.map((e) => ({ ...e }));
  for (const e of b.byEntry) {
    const found = byEntry.find((x) => x.name === e.name);
    if (found) {
      found.wins += e.wins;
      found.played += e.played;
    } else byEntry.push({ ...e });
  }
  const byArchetype = Object.fromEntries(
    ARCHETYPES.map((x) => [
      x,
      Object.fromEntries(
        ARCHETYPES.map((y) => [
          y,
          {
            wins: a.byArchetype[x][y].wins + b.byArchetype[x][y].wins,
            played: a.byArchetype[x][y].played + b.byArchetype[x][y].played,
          },
        ]),
      ),
    ]),
  ) as TournamentResult['byArchetype'];
  return {
    games: a.games + b.games,
    byEntry,
    byArchetype,
    telemetry: mergeTelemetry(a.telemetry, b.telemetry),
  };
}

const pct = (wins: number, played: number): string =>
  played === 0 ? '-' : `${((100 * wins) / played).toFixed(1)} %`;

/** Tableau markdown : classement par taux de victoire, puis archétype contre archétype. */
export function formatTournament(result: TournamentResult): string {
  const rate = (e: { wins: number; played: number }) =>
    e.wins / Math.max(e.played, 1);
  const ranked = [...result.byEntry].sort(
    (x, y) => rate(y) - rate(x) || x.name.localeCompare(y.name),
  );
  const lines = [
    `${result.games} parties.`,
    '',
    '| Deck | Archétype | Niveau | Victoires | Parties | Taux |',
    '|---|---|---|---|---|---|',
    ...ranked.map(
      (e) =>
        `| ${e.name} | ${e.archetype} | ${e.level} | ${e.wins} | ${e.played} | ${pct(e.wins, e.played)} |`,
    ),
    '',
    `| Archétype (ligne) contre (colonne) | ${ARCHETYPES.join(' | ')} |`,
    `|---|${ARCHETYPES.map(() => '---').join('|')}|`,
    ...ARCHETYPES.map(
      (a) =>
        `| ${a} | ` +
        ARCHETYPES.map((b) => {
          const c = result.byArchetype[a][b];
          return `${pct(c.wins, c.played)} (${c.wins}/${c.played})`;
        }).join(' | ') +
        ' |',
    ),
  ];
  return lines.join('\n');
}
