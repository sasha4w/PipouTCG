import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { Card } from '../../../cards/card.entity';
import { effectiveAtk, seatPlayer } from '../../helpers/game-state.helper';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../../interfaces/game-state.interface';
import { activeChoice } from '../candidate-actions';
import { inferArchetype } from '../planner';

/** À incrémenter à chaque changement d'encodage : les poids anciens sont refusés. */
export const ENCODING_VERSION = 1;
export const CARD_DIM = 32;
export const GLOBAL_DIM = 22;
/** Premier indice de l'état en jeu : avant, la carte seule (stats de base). */
export const STATIC_FROM = 18;

export const ARCHETYPES: readonly AdventureArchetype[] = [
  'pipou',
  'pixelman',
  'dragon',
];
const ELEMENTS = ['earth', 'fire', 'wind', 'water'];
const STAGES = ['egg', 'baby', 'young', 'adult', 'ancestral'];
const SUPPORT_TYPES = ['EPHEMERAL', 'EQUIPMENT', 'PERSISTENT', 'CHARGE'];
const PHASES = ['mulligan', 'main', 'battle', 'end'];

export const SET_NAMES = [
  'myMonsters',
  'oppMonsters',
  'mySupports',
  'oppSupports',
  'myHand',
  'myRemaining',
  'oppHidden',
] as const;
export type SetName = (typeof SET_NAMES)[number];

/** Les grands ensembles (decks) pèsent moins par carte : leur somme reste du même ordre. */
export const SET_SCALE: Record<SetName, number> = {
  myMonsters: 1,
  oppMonsters: 1,
  mySupports: 1,
  oppSupports: 1,
  myHand: 1,
  myRemaining: 0.1,
  oppHidden: 0.1,
};

/** Une carte : son identifiant (embedding) et ses caractéristiques. */
export interface EncodedCard {
  i: number;
  x: number[];
}

export interface EncodedPosition {
  global: number[];
  sets: Record<SetName, EncodedCard[]>;
}

/** Carte statique : `x` omis, relu dans la table des cartes. */
export interface CompactCard {
  i: number;
  x?: number[];
}

export interface CompactPosition {
  global: number[];
  sets: Record<SetName, CompactCard[]>;
}

function oneHot(
  x: number[],
  from: number,
  values: readonly string[],
  value: string | null | undefined,
): void {
  const k = value == null ? -1 : values.indexOf(value);
  if (k >= 0) x[from + k] = 1;
}

/** Caractéristiques de la carte seule ; l'état en jeu (18 à 31) reste à 0. */
export function staticCardFeatures(card: Card): number[] {
  const x = new Array<number>(CARD_DIM).fill(0);
  x[0] = card.type === 'monster' ? 1 : 0;
  x[1] = card.type === 'support' ? 1 : 0;
  x[2] = card.atk / 1000;
  x[3] = card.hp / 1000;
  x[4] = card.cost / 10;
  oneHot(x, 5, ELEMENTS, card.element);
  oneHot(x, 9, STAGES, card.stage);
  oneHot(x, 14, SUPPORT_TYPES, card.supportType);
  return x;
}

/** Vrai si la carte ne porte aucun état de partie : sa valeur ne dépend que de son id. */
export function isStaticCard(x: readonly number[]): boolean {
  for (let d = STATIC_FROM; d < x.length; d++) if (x[d] !== 0) return false;
  return true;
}

function instanceCard(c: CardInstance): EncodedCard {
  const x = staticCardFeatures(c.baseCard);
  x[30] = (c.chargeCounters ?? 0) / 5;
  x[31] = c.token ? 1 : 0;
  return { i: c.baseCard.id, x };
}

function monsterCard(m: MonsterOnBoard): EncodedCard {
  const { i, x } = instanceCard(m.card);
  x[18] = 1;
  x[19] = effectiveAtk(m) / 1000;
  x[20] = m.currentHp / 1000;
  x[21] = m.hpBuff / 1000;
  x[22] = m.mode === 'guard' ? 1 : 0;
  x[23] = m.hasTaunt ? 1 : 0;
  x[24] = m.hasPiercing ? 1 : 0;
  x[25] = (m.damageReduction ?? 0) / 4;
  x[26] = m.immunities.length / 4;
  x[27] =
    Math.max(
      0,
      m.attacksPerTurn + m.extraAttacksThisTurn - m.attacksUsedThisTurn,
    ) / 2;
  x[28] = m.summonedThisTurn ? 1 : 0;
  x[29] = m.equipments.length / 3;
  return { i, x };
}

const byId = (a: EncodedCard, b: EncodedCard) => a.i - b.i;

function monsters(p: PlayerGameState): EncodedCard[] {
  return p.monsterZones.flatMap((m) => (m ? [monsterCard(m)] : [])).sort(byId);
}

/** Supports posés et équipements des monstres. */
function supports(p: PlayerGameState): EncodedCard[] {
  const placed = p.supportZones.flatMap((c) => (c ? [instanceCard(c)] : []));
  const equipped = p.monsterZones.flatMap((m) =>
    m ? m.equipments.map(instanceCard) : [],
  );
  return [...placed, ...equipped].sort(byId);
}

const cards = (list: CardInstance[]) => list.map(instanceCard).sort(byId);

/**
 * Position vue par `seat`, information publique seulement. Les cartes cachées
 * de l'adversaire (main, deck, Primes) forment un seul multiensemble, comme
 * dans `determinize.ts` : l'encodage ne dépend pas de leur répartition.
 */
export function encodePosition(
  game: GameState,
  seat: Seat,
  archetype: AdventureArchetype,
): EncodedPosition {
  const me = seatPlayer(game, seat);
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
  const global = new Array<number>(GLOBAL_DIM).fill(0);
  global[0] = game.currentTurnUserId === me.userId ? 1 : 0;
  global[1] = Math.min(game.turnNumber, 30) / 30;
  global[2] = me.primes / 6;
  global[3] = opp.primes / 6;
  global[4] = me.hand.length / 7;
  global[5] = opp.hand.length / 7;
  global[6] = me.deck.length / 40;
  global[7] = opp.deck.length / 40;
  global[8] = me.graveyard.length / 40;
  global[9] = opp.graveyard.length / 40;
  global[10] = me.recycleEnergy / 10;
  oneHot(global, 11, PHASES, game.phase);
  global[15] = activeChoice(game)?.forUserId === me.userId ? 1 : 0;
  oneHot(global, 16, ARCHETYPES, archetype);
  oneHot(global, 19, ARCHETYPES, inferArchetype(opp));
  return {
    global,
    sets: {
      myMonsters: monsters(me),
      oppMonsters: monsters(opp),
      mySupports: supports(me),
      oppSupports: supports(opp),
      myHand: cards(me.hand),
      myRemaining: cards([...me.deck, ...me.primeDeck]),
      oppHidden: cards([...opp.hand, ...opp.deck, ...opp.primeDeck]),
    },
  };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Forme écrite sur disque : `x` arrondi, omis pour une carte statique. */
export function compactPosition(pos: EncodedPosition): CompactPosition {
  const sets = {} as Record<SetName, CompactCard[]>;
  for (const name of SET_NAMES)
    sets[name] = pos.sets[name].map((c) =>
      isStaticCard(c.x) ? { i: c.i } : { i: c.i, x: c.x.map(round4) },
    );
  return { global: pos.global.map(round4), sets };
}

/** Inverse de `compactPosition` ; `cards` donne `x` des cartes statiques par id. */
export function expandPosition(
  pos: CompactPosition,
  cards: Record<string, number[]>,
): EncodedPosition {
  const sets = {} as Record<SetName, EncodedCard[]>;
  for (const name of SET_NAMES)
    sets[name] = pos.sets[name].map((c) => {
      const x = c.x ?? cards[String(c.i)];
      if (!x) throw new Error(`Carte ${c.i} absente de la table des cartes`);
      return { i: c.i, x };
    });
  return { global: pos.global, sets };
}
