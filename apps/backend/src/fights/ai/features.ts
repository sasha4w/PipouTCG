import { SupportType, isImplanted } from '@pipou/shared';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { effectiveAtk, seatPlayer } from '../helpers/game-state.helper';
import { chargesOf } from '../helpers/charges';
import { ARCHETYPE_PROFILES } from './archetype-profiles';
import {
  STAGE_RANK,
  blocked,
  cardUsefulness,
  damageTo,
  handPrep,
  hasAttacksLeft,
  isEgg,
  isGrowing,
  monsterValue,
  protectWeight,
  raid,
  reinforcements,
} from './evaluate';

/**
 * Noms des caractéristiques, dans l'ordre du vecteur. L'ordre est celui des
 * poids appris (`learned-weights.ts`) : en ajouter ou en déplacer une impose
 * de réentraîner.
 */
export const FEATURE_NAMES = [
  'bias',
  'myTurn',
  'turn',
  'myPrimesLeft',
  'oppPrimesLeft',
  'myLastPrime',
  'oppLastPrime',
  'handCount',
  'handUsefulness',
  'oppHandCount',
  'energy',
  'cardDiff',
  'persistents',
  'oppPersistents',
  'charges',
  'oppCharges',
  'counters',
  'counterTurns',
  'myMonsters',
  'myAtk',
  'myHp',
  'myEquipments',
  'myGuard',
  'myMissingHp',
  'oppMonsters',
  'oppAtk',
  'oppHp',
  'oppEquipments',
  'oppGuard',
  'oppMissingHp',
  'finishable',
  'myFinishable',
  'threatPrimes',
  'threatLethal',
  'threatValue',
  'threatCost',
  'threatProtected',
  'potentialPrimes',
  'potentialLethal',
  'stageSum',
  'growingHp',
  'mostEquipped',
  'prepEvolve',
  'prepEquip',
  'prepTarget',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

const sum = <T>(list: readonly T[], f: (x: T) => number) =>
  list.reduce((s, x) => s + f(x), 0);

/** Un Zeta implanté appartient à son poseur : hors du plateau de l'hôte. */
const ownZones = (host: PlayerGameState) =>
  host.monsterZones.map((m) => (m && !isImplanted(m, host.userId) ? m : null));

const persistents = (p: PlayerGameState) =>
  p.supportZones.filter(
    (z) => z?.baseCard.supportType === SupportType.PERSISTENT,
  ).length;

/** Une Charge compte plus à mesure qu'elle approche de son seuil. */
const charges = (p: PlayerGameState) =>
  sum(
    chargesOf(p),
    (c) => 1 + (c.chargeCounters ?? 0) / (c.baseCard.chargeMax ?? 1),
  );

const missingHp = (m: MonsterOnBoard) =>
  Math.max(0, (m.card.baseCard.hp ?? 0) - m.currentHp);

/** Monstres de `targets` qu'une seule attaque d'un monstre de `attackers` détruit. */
function finishableBy(
  targets: readonly MonsterOnBoard[],
  attackers: readonly MonsterOnBoard[],
): number {
  const strikers = attackers.filter((m) => !isEgg(m) && !blocked(m));
  return targets.filter((d) =>
    strikers.some((m) => damageTo(d, m) >= d.currentHp),
  ).length;
}

/**
 * L'état vu par `seat`, en nombres, dans l'ordre de `FEATURE_NAMES`. Aucune
 * pondération ici : c'est le travail des poids appris. L'appelant fournit un
 * état déterminisé (les cartes cachées y sont un tirage plausible).
 */
export function features(
  game: GameState,
  seat: Seat,
  archetype: AdventureArchetype,
): number[] {
  const me = seatPlayer(game, seat);
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
  const profile = ARCHETYPE_PROFILES[archetype];
  const myZones = ownZones(me);
  const oppZones = ownZones(opp);
  const mine = myZones.filter((m): m is MonsterOnBoard => m !== null);
  const theirs = oppZones.filter((m): m is MonsterOnBoard => m !== null);
  const myTurn = game.currentTurnUserId === me.userId;

  const cards = (p: PlayerGameState, board: readonly MonsterOnBoard[]) =>
    p.hand.length +
    board.length +
    sum(board, (m) => m.equipments.length) +
    p.supportZones.filter((c) => c !== null).length;

  // Compteurs de tour : la Prime va à celui qui a posé le monstre
  let counters = 0;
  let counterTurns = 0;
  for (const host of [me, opp])
    for (const m of host.monsterZones)
      if (m && m.turnCounter !== undefined) {
        const sign = (m.ownerUserId ?? host.userId) === me.userId ? 1 : -1;
        counters += sign;
        counterTurns += sign * m.turnCounter;
      }

  // Tour adverse : ses monstres repassent en ATK, ses renforts attaquent
  const threat = raid(
    [...theirs, ...reinforcements(opp)]
      .filter((m) => !isEgg(m) && !blocked(m) && !m.guardLocked)
      .map((m) => ({ m, attacks: m.attacksPerTurn })),
    myZones,
    true,
  );
  const threatPrimes = threat.primes - threat.conceded;

  // Mon tour : Primes encore à prendre avec les attaques qui me restent
  let potentialPrimes = 0;
  if (myTurn && (game.phase === 'main' || game.phase === 'battle')) {
    const potential = raid(
      mine
        .map((m) => ({ m, attacks: hasAttacksLeft(m) }))
        .filter((a) => a.attacks > 0),
      oppZones,
      game.turnNumber > 1,
    );
    potentialPrimes = potential.primes - potential.conceded;
  }

  const prep = handPrep(me, opp);
  const guard = (list: readonly MonsterOnBoard[]) =>
    list.filter((m) => m.mode === 'guard').length;

  const values: Record<FeatureName, number> = {
    bias: 1,
    myTurn: myTurn ? 1 : 0,
    turn: Math.min(game.turnNumber, 20) / 10,
    myPrimesLeft: me.primes,
    oppPrimesLeft: opp.primes,
    myLastPrime: me.primes === 1 ? 1 : 0,
    oppLastPrime: opp.primes === 1 ? 1 : 0,
    handCount: me.hand.length,
    handUsefulness: sum(me.hand, (c) => cardUsefulness(c.baseCard)) / 100,
    oppHandCount: opp.hand.length,
    energy: me.recycleEnergy,
    cardDiff: cards(me, mine) - cards(opp, theirs),
    persistents: persistents(me),
    oppPersistents: persistents(opp),
    charges: charges(me),
    oppCharges: charges(opp),
    counters,
    counterTurns,
    myMonsters: mine.length,
    myAtk: sum(mine, effectiveAtk) / 100,
    myHp: sum(mine, (m) => Math.max(0, m.currentHp)) / 100,
    myEquipments: sum(mine, (m) => m.equipments.length),
    myGuard: guard(mine),
    myMissingHp: sum(mine, missingHp) / 100,
    oppMonsters: theirs.length,
    oppAtk: sum(theirs, effectiveAtk) / 100,
    oppHp: sum(theirs, (m) => Math.max(0, m.currentHp)) / 100,
    oppEquipments: sum(theirs, (m) => m.equipments.length),
    oppGuard: guard(theirs),
    oppMissingHp: sum(theirs, missingHp) / 100,
    finishable: finishableBy(theirs, mine),
    myFinishable: finishableBy(mine, theirs),
    threatPrimes,
    threatLethal: threatPrimes > 0 && threatPrimes >= opp.primes ? 1 : 0,
    threatValue: sum(threat.destroyed, monsterValue) / 100,
    // Cartes payées pour ce que l'adversaire peut détruire : la carte et son coût
    threatCost: sum(threat.destroyed, (d) => 1 + (d.card.baseCard.cost ?? 0)),
    threatProtected: sum(threat.destroyed, (d) =>
      protectWeight(d, myZones, profile),
    ),
    potentialPrimes,
    potentialLethal:
      potentialPrimes > 0 && potentialPrimes >= me.primes ? 1 : 0,
    stageSum: sum(mine, (m) => STAGE_RANK[m.card.baseCard.stage ?? ''] ?? 0),
    growingHp:
      sum(mine, (m) => (isGrowing(m) ? Math.max(0, m.currentHp) : 0)) / 100,
    mostEquipped: Math.max(
      0,
      ...mine
        .filter((m) => m.turnCounter === undefined)
        .map((m) => m.equipments.length),
    ),
    prepEvolve: prep.evolve,
    prepEquip: prep.equip,
    prepTarget: prep.target,
  };
  return FEATURE_NAMES.map((name) => values[name]);
}
