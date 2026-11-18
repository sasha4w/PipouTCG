import type { Seat } from '@pipou/shared';
import type { Card } from '../../../cards/card.entity';
import { seatPlayer } from '../../helpers/game-state.helper';
import type { GameState } from '../../interfaces/game-state.interface';
import { aiMustAct } from '../ai-player';
import { determinize } from '../determinize';
import { buildGeneratedEntries } from '../generated-entries';
import type { Note } from '../note';
import { MAX_ACTIONS, playGame, seeded } from '../tournament';
import type { TournamentEntry } from '../tournament';
import {
  CARD_DIM,
  ENCODING_VERSION,
  GLOBAL_DIM,
  SET_NAMES,
  SET_SCALE,
  compactPosition,
  encodePosition,
  staticCardFeatures,
} from './encode';
import type { CompactPosition } from './encode';

/** Une position, vue par un joueur, étiquetée par le résultat de sa partie. */
export interface NnSample extends CompactPosition {
  /** Rang de la partie : sert à mettre des parties entières en validation. */
  g: number;
  /** ENCODING_VERSION. */
  v: number;
  /** +1 victoire, −1 défaite, 0 sans vainqueur. */
  y: number;
}

export interface SelfplayGame {
  g: number;
  p1: TournamentEntry;
  p2: TournamentEntry;
  seed: number;
}

export interface SelfplayOptions {
  games: number;
  seed: number;
  note: Note;
  /** Nœuds du planificateur par décision (la cible vient du résultat, pas de la recherche). */
  budget: number;
  /** Température des premières décisions : variété des parties. */
  temperature: number;
  exploreDecisions: number;
}

/** Positions gardées par joueur, par partie et par sorte (milieu ou fin de tour). */
export const SAMPLES_PER_KIND = 4;
/** Graines de decks de l'auto-jeu ; 1 à 30 : contrôles, 5001+ : arène. */
const FIRST_DECK_SEED = 101;
const DECK_SEEDS = 500;

/** Parties de la génération, dans un ordre qui ne dépend pas du nombre de processus. */
export function planSelfplay(
  cards: Card[],
  o: SelfplayOptions,
): SelfplayGame[] {
  const decks = new Map<number, TournamentEntry[]>();
  const brain = (e: TournamentEntry): TournamentEntry => ({
    ...e,
    brain: 'plan',
    thinking: { budget: o.budget },
    note: o.note,
    temperature: o.temperature,
    temperatureDecisions: o.exploreDecisions,
  });
  const out: SelfplayGame[] = [];
  for (let g = 0; g < o.games; g++) {
    const r = seeded(o.seed * 1_000_003 + g);
    const deckSeed = FIRST_DECK_SEED + Math.floor(r() * DECK_SEEDS);
    let entries = decks.get(deckSeed);
    if (!entries) {
      entries = buildGeneratedEntries(cards, deckSeed);
      decks.set(deckSeed, entries);
    }
    const i = Math.floor(r() * entries.length);
    let j = Math.floor(r() * (entries.length - 1));
    if (j >= i) j++;
    out.push({
      g,
      p1: brain(entries[i]),
      p2: brain(entries[j]),
      seed: Math.floor(r() * 2 ** 31),
    });
  }
  return out;
}

interface Reservoir {
  seen: number;
  kept: CompactPosition[];
}

/**
 * Joue une partie et en tire des positions, vues par le joueur qui vient de
 * jouer, sur une copie déterminisée. Le tirage des positions a son propre
 * générateur : la partie est la même avec ou sans collecte.
 */
export function collectGame(game: SelfplayGame): NnSample[] {
  const pick = seeded(game.seed ^ 0x51ed270b);
  const entry = { p1: game.p1, p2: game.p2 };
  const pools: Record<Seat, Record<'end' | 'mid', Reservoir>> = {
    p1: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
    p2: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
  };
  const observe = (state: GameState, seat: Seat) => {
    // Une fin de partie n'a pas besoin d'être apprise : elle vaut ±Infinity
    if (state.phase === 'finished') return;
    const kind = aiMustAct(state, seatPlayer(state, seat).userId)
      ? 'mid'
      : 'end';
    const pool = pools[seat][kind];
    pool.seen++;
    // Échantillonnage par réservoir : chaque position a la même chance
    let slot = pool.kept.length;
    if (slot >= SAMPLES_PER_KIND) {
      slot = Math.floor(pick() * pool.seen);
      if (slot >= SAMPLES_PER_KIND) return;
    }
    pool.kept[slot] = compactPosition(
      encodePosition(
        determinize(state, seat, pick),
        seat,
        entry[seat].archetype,
      ),
    );
  };
  const { winner } = playGame(
    game.p1,
    game.p2,
    game.seed,
    MAX_ACTIONS,
    undefined,
    observe,
  );
  const label = (seat: Seat) =>
    winner === null ? 0 : (winner === 0) === (seat === 'p1') ? 1 : -1;
  const out: NnSample[] = [];
  for (const s of ['p1', 'p2'] as const)
    for (const kind of ['end', 'mid'] as const)
      for (const pos of pools[s][kind].kept)
        out.push({ g: game.g, v: ENCODING_VERSION, ...pos, y: label(s) });
  return out;
}

export interface SelfplayMeta {
  encodingVersion: number;
  globalDim: number;
  cardDim: number;
  sets: string[];
  setScale: number[];
  /** x statique de chaque carte, par id : Python ne réimplémente pas l'encodage. */
  cards: Record<string, number[]>;
}

export function selfplayMeta(cards: Card[]): SelfplayMeta {
  return {
    encodingVersion: ENCODING_VERSION,
    globalDim: GLOBAL_DIM,
    cardDim: CARD_DIM,
    sets: [...SET_NAMES],
    setScale: SET_NAMES.map((n) => SET_SCALE[n]),
    cards: Object.fromEntries(
      cards.map((c) => [String(c.id), staticCardFeatures(c)]),
    ),
  };
}
