import { randomUUID } from 'node:crypto';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { createGameState } from '../helpers/game-factory';
import type { CardInstance } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { AiPlayer, aiMustAct } from './ai-player';
import type { AiLevel } from './ai-player';

/** Garde-fou : une partie qui dépasse ce nombre d'actions n'a pas de vainqueur. */
const MAX_ACTIONS = 2000;

export interface TournamentEntry {
  name: string;
  archetype: AdventureArchetype;
  level: AiLevel;
  /** Une entrée par exemplaire. */
  deck: Card[];
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
}

const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];

/** mulberry32 : générateur déterministe. */
function seeded(seed: number): () => number {
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

/** Joue une partie ; renvoie l'indice du vainqueur (0 = p1, 1 = p2) ou null. */
function playGame(
  p1: TournamentEntry,
  p2: TournamentEntry,
  seed: number,
): 0 | 1 | null {
  const random = seeded(seed);
  // PickService mélange avec Math.random : on le fige pendant la partie
  const realRandom = Math.random;
  Math.random = seeded(seed ^ 0x9e3779b9);
  try {
    const engine = createEngine(fixedRng());
    const ai = new AiPlayer(engine, random);
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
    let actions = 0;
    while (game.phase !== 'finished' && actions < MAX_ACTIONS) {
      const actor = seats.find((s) => aiMustAct(game, s.userId));
      if (!actor) return null;
      const action = ai.chooseAction(game, actor.seat, {
        archetype: actor.entry.archetype,
        level: actor.entry.level,
      });
      engine.dispatch(game, actor.seat, action);
      actions++;
    }
    if (game.phase !== 'finished') return null;
    if (game.winner === 1) return 0;
    if (game.winner === 2) return 1;
    return null;
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
  const byEntry = entries.map((e) => ({
    name: e.name,
    archetype: e.archetype,
    level: e.level,
    wins: 0,
    played: 0,
  }));
  const byArchetype = Object.fromEntries(
    ARCHETYPES.map((a) => [
      a,
      Object.fromEntries(ARCHETYPES.map((b) => [b, { wins: 0, played: 0 }])),
    ]),
  ) as TournamentResult['byArchetype'];

  let games = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      for (let g = 0; g < gamesPerPair; g++) {
        const [a, b] = g % 2 === 0 ? [i, j] : [j, i];
        onGame?.({ p1: entries[a].name, p2: entries[b].name });
        const winner = playGame(entries[a], entries[b], seed + games * 7919);
        games++;
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
      }
    }
  }
  return { games, byEntry, byArchetype };
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
