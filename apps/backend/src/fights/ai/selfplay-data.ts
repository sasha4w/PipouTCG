import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { seatPlayer } from '../helpers/game-state.helper';
import { aiMustAct } from './ai-player';
import { determinize } from './determinize';
import { features } from './features';
import { MAX_ACTIONS, playGame, seeded } from './tournament';
import type { TournamentEntry } from './tournament';

/** Une position étiquetée par le résultat de sa partie. */
export interface Sample {
  /** Rang de la partie : sert à trier et à mettre des parties de côté. */
  g: number;
  s: Seat;
  /** Archétype du joueur, puis de son adversaire. */
  a: AdventureArchetype;
  o: AdventureArchetype;
  /** true : le joueur n'a plus à jouer (fin de tour) ; false : milieu de tour. */
  end: boolean;
  f: number[];
  /** 1 victoire, 0 défaite, 0,5 sans vainqueur. */
  y: number;
}

/** Positions gardées par joueur, par partie et par sorte (milieu ou fin de tour). */
export const SAMPLES_PER_KIND = 4;

interface Reservoir {
  seen: number;
  kept: number[][];
}

/**
 * Joue une partie et en tire des positions, vues par le joueur qui vient de
 * jouer, sur une copie déterminisée. Le tirage des positions a son propre
 * générateur : la partie est la même avec ou sans collecte.
 */
export function collectGame(
  p1: TournamentEntry,
  p2: TournamentEntry,
  seed: number,
  g: number,
): Sample[] {
  const pick = seeded(seed ^ 0x51ed270b);
  const entry = { p1, p2 };
  const pools: Record<Seat, Record<'end' | 'mid', Reservoir>> = {
    p1: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
    p2: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
  };

  const observe = (game: GameState, seat: Seat) => {
    // Une fin de partie n'a pas besoin d'être apprise : elle vaut ±Infinity
    if (game.phase === 'finished') return;
    const kind = aiMustAct(game, seatPlayer(game, seat).userId) ? 'mid' : 'end';
    const pool = pools[seat][kind];
    pool.seen++;
    // Échantillonnage par réservoir : chaque position a la même chance
    let slot = pool.kept.length;
    if (slot >= SAMPLES_PER_KIND) {
      slot = Math.floor(pick() * pool.seen);
      if (slot >= SAMPLES_PER_KIND) return;
    }
    pool.kept[slot] = features(
      determinize(game, seat, pick),
      seat,
      entry[seat].archetype,
    );
  };

  const { winner } = playGame(p1, p2, seed, MAX_ACTIONS, undefined, observe);
  const label = (seat: Seat) =>
    winner === null ? 0.5 : (winner === 0) === (seat === 'p1') ? 1 : 0;

  const out: Sample[] = [];
  for (const s of ['p1', 'p2'] as const)
    for (const kind of ['end', 'mid'] as const)
      for (const f of pools[s][kind].kept)
        out.push({
          g,
          s,
          a: entry[s].archetype,
          o: entry[s === 'p1' ? 'p2' : 'p1'].archetype,
          end: kind === 'end',
          f,
          y: label(s),
        });
  return out;
}
