import type { Seat } from '@pipou/shared';
import type {
  CardInstance,
  GameState,
  PlayerGameState,
} from '../interfaces/game-state.interface';

type HiddenZone = 'hand' | 'deck' | 'primeDeck';

/**
 * Copie de l'état telle que `seat` peut se la représenter : l'ordre de son
 * deck et de ses Primes est mélangé (chaque zone à part), la main, le deck
 * et les Primes de l'adversaire sont redistribués ensemble, aux mêmes
 * tailles. Une carte citée par un choix en attente reste à sa place, pour
 * que le choix reste valide dans la copie. Ne modifie pas `game`.
 */
export function determinize(
  game: GameState,
  seat: Seat,
  random: () => number,
): GameState {
  const copy = structuredClone({ ...game, log: [], pendingEvents: [] });
  const cited = new Set(
    copy.pendingChoices.flatMap((c) => c.candidates.map((x) => x.instanceId)),
  );
  const [me, opp] =
    seat === 'p1' ? [copy.player1, copy.player2] : [copy.player2, copy.player1];
  // Mes Primes restent mes Primes : les mêler au deck ferait jouer des coups
  // que le moteur refuse (ex. Transformer vers un Bébé qui est en Prime)
  redeal(me, ['deck'], cited, random);
  redeal(me, ['primeDeck'], cited, random);
  redeal(opp, ['hand', 'deck', 'primeDeck'], cited, random);
  return copy;
}

/** Mélange les cartes non citées des zones et les remet dans les places libres. */
function redeal(
  player: PlayerGameState,
  zones: HiddenZone[],
  cited: Set<string>,
  random: () => number,
): void {
  const pool: CardInstance[] = zones.flatMap((z) =>
    player[z].filter((c) => !cited.has(c.instanceId)),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let next = 0;
  for (const z of zones)
    player[z] = player[z].map((c) =>
      cited.has(c.instanceId) ? c : pool[next++],
    );
}
