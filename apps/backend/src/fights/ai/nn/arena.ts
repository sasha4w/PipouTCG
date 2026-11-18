import type { Card } from '../../../cards/card.entity';
import type { AiLevel } from '../ai-player';
import { buildGeneratedEntries } from '../generated-entries';
import { parseNote } from '../note';
import type { Note } from '../note';
import { MAX_ACTIONS, playGame, seeded } from '../tournament';
import type { TournamentEntry } from '../tournament';
import { wilson } from './stats';

/** Un cerveau d'arène : le planificateur fort avec une note, ou un niveau d'aventure (note réseau). */
export type Side = Note | { level: AiLevel };

export function parseSide(raw: string): Side {
  const m = /^level:(\d)$/.exec(raw);
  if (m) {
    const level = Number(m[1]);
    if (level < 1 || level > 5)
      throw new Error(`Niveau inconnu « ${raw} » (level:1 à level:5)`);
    return { level: level as AiLevel };
  }
  return parseNote(raw, 'legacy');
}

export interface ArenaSettings {
  challenger: Side;
  champion: Side;
  /** Nœuds par décision du planificateur fort. */
  budget: number;
  /** Temps par décision : comparaison à temps égal (jauge). */
  timeMs?: number;
}

export interface ArenaPair {
  k: number;
  deckSeed: number;
  i: number;
  j: number;
  seed: number;
}

/** Du point de vue du challenger. */
export type Outcome = 'win' | 'loss' | 'draw';

/** Decks jamais vus en auto-jeu (101 à 600). */
const FIRST_DECK_SEED = 5001;

export function planArena(pairs: number, seed: number): ArenaPair[] {
  return Array.from({ length: pairs }, (_, k) => {
    const r = seeded(seed * 1_000_003 + k);
    const i = Math.floor(r() * 15);
    let j = Math.floor(r() * 14);
    if (j >= i) j++;
    return {
      k,
      deckSeed: FIRST_DECK_SEED + k,
      i,
      j,
      seed: Math.floor(r() * 2 ** 31),
    };
  });
}

function entry(
  base: TournamentEntry,
  side: Side,
  s: ArenaSettings,
  name: string,
): TournamentEntry {
  if (typeof side === 'object' && 'level' in side)
    return { ...base, name, brain: 'level', level: side.level, note: 'nn' };
  return {
    ...base,
    name,
    brain: 'plan',
    thinking: {
      budget: s.budget,
      ...(s.timeMs !== undefined && { timeLimitMs: s.timeMs }),
    },
    note: side,
  };
}

/**
 * Deux parties, même graine : le challenger joue le deck i en p1, puis le
 * deck j en p2. Chaque cerveau joue chaque deck et chaque siège une fois.
 */
export function playPair(
  cards: Card[],
  pair: ArenaPair,
  s: ArenaSettings,
): [Outcome, Outcome] {
  const decks = buildGeneratedEntries(cards, pair.deckSeed);
  const [di, dj] = [decks[pair.i], decks[pair.j]];
  const outcome = (winner: 0 | 1 | null, challengerSeat: 0 | 1): Outcome =>
    winner === null ? 'draw' : winner === challengerSeat ? 'win' : 'loss';
  const a = playGame(
    entry(di, s.challenger, s, 'challenger'),
    entry(dj, s.champion, s, 'champion'),
    pair.seed,
    MAX_ACTIONS,
  );
  const b = playGame(
    entry(di, s.champion, s, 'champion'),
    entry(dj, s.challenger, s, 'challenger'),
    pair.seed,
    MAX_ACTIONS,
  );
  return [outcome(a.winner, 0), outcome(b.winner, 1)];
}

export interface ArenaVerdict {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** (victoires + nuls / 2) / parties. */
  score: number;
  lower: number;
  upper: number;
}

export function verdict(outcomes: Outcome[]): ArenaVerdict {
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const [wins, losses, draws] = [count('win'), count('loss'), count('draw')];
  const games = outcomes.length;
  const points = wins + draws / 2;
  return {
    games,
    wins,
    losses,
    draws,
    score: games ? points / games : 0,
    ...wilson(points, games),
  };
}
