import {
  ActionType,
  CardType,
  DrakonStage,
  EffectTarget,
  EffectTrigger,
  isImplanted,
} from '@pipou/shared';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import type {
  GameState,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';
import { effectiveAtk, seatPlayer } from '../helpers/game-state.helper';

/** Valeur d'une Prime : la condition de victoire domine tout le reste. */
const PRIME = 2500;
/** Présence d'un monstre sur le terrain, en plus de ses statistiques. */
const MONSTER_PRESENCE = 100;
const EQUIPMENT_VALUE = 100;
const TERRAIN_VALUE = 150;
const ENERGY_VALUE = 50;
const HAND_CARD_BASE = 100;
/** Prime que l'adversaire peut prendre à son prochain tour (estimation). */
const THREAT_PRIME = PRIME * 0.6;
/** Prime que je peux encore prendre ce tour (phase principale). */
const POTENTIAL_PRIME = PRIME * 0.3;
/** Prime promise par un compteur de tour (Noyau Zeta). */
const COUNTER_PRIME = PRIME * 0.3;
/** Surcoût d'un monstre « à protéger » (noyau équipé, Drakon en croissance). */
const PROTECT_PENALTY = PRIME * 0.3;

const PIPOU_PER_MONSTER = 400;
const PIXELMAN_PER_EQUIPMENT = 400;
/** Un équipement sur un Noyau compte davantage : c'est lui qu'on bombarde. */
const PIXELMAN_CORE_FACTOR = 1.25;
const PIXELMAN_CORE_PRESENCE = 300;
const DRAGON_PER_STAGE = 300;
const DRAGON_GROWING_HP = 0.3;

const STAGE_RANK: Record<string, number> = {
  [DrakonStage.EGG]: 1,
  [DrakonStage.BABY]: 2,
  [DrakonStage.YOUNG]: 3,
  [DrakonStage.ADULT]: 4,
};

/** Intérêt d'une carte en main : sert aussi à choisir quoi défausser. */
export function cardUsefulness(card: Card): number {
  if (card.type === CardType.MONSTER)
    return (card.atk ?? 0) + (card.hp ?? 0) / 2 + 100 * (card.cost ?? 0);
  return 400;
}

function monsterValue(m: MonsterOnBoard): number {
  return (
    MONSTER_PRESENCE +
    effectiveAtk(m) +
    Math.max(0, m.currentHp) / 2 +
    EQUIPMENT_VALUE * m.equipments.length
  );
}

const isEgg = (m: MonsterOnBoard) => m.card.baseCard.stage === DrakonStage.EGG;

/** Noyau Pixelman (Alpha, Beta, Zeta…). */
const isCore = (m: MonsterOnBoard) => /^noyau /i.test(m.card.baseCard.name);

/** Unité Drakon pas encore adulte (œuf, bébé, jeune). */
function isGrowing(m: MonsterOnBoard): boolean {
  const stage = m.card.baseCard.stage;
  return !!stage && stage !== DrakonStage.ADULT;
}

/** Dégâts de combat réellement subis par `target`. */
function damageTo(target: MonsterOnBoard, attacker: MonsterOnBoard): number {
  if (target.combatImmune) return 0;
  const atk = effectiveAtk(attacker);
  return target.damageReduction && !attacker.hasPiercing
    ? Math.ceil(atk / target.damageReduction)
    : atk;
}

const blocked = (m: MonsterOnBoard) =>
  m.blockAttackTurns !== undefined && m.blockAttackTurns > 0;

function hasAttacksLeft(m: MonsterOnBoard): number {
  if (isEgg(m) || m.mode !== 'attack' || blocked(m)) return 0;
  if (m.summonedThisTurn && m.cannotAttackOnSummonTurn) return 0;
  return Math.max(
    0,
    m.attacksPerTurn + m.extraAttacksThisTurn - m.attacksUsedThisTurn,
  );
}

/**
 * Un bonus d'équipe compte double pour l'attaquant : il profite à chaque
 * tour et à chaque nouvel allié, pas seulement aux stats du moment.
 */
const BOOST_TARGET_FACTOR = 2;

interface Raid {
  primes: number;
  destroyed: MonsterOnBoard[];
}

/**
 * Estimation gloutonne d'une phase de combat : chaque attaquant, du plus fort
 * au plus faible, attaque en direct si le terrain est vide, sinon détruit une
 * cible qu'il bat sans mourir à la riposte : d'abord celles qui rapportent
 * une Prime (mode ATK), la plus précieuse en premier (stats + bonus d'équipe).
 */
function raid(
  attackers: { m: MonsterOnBoard; attacks: number }[],
  defenderZones: readonly (MonsterOnBoard | null)[],
  directAllowed: boolean,
): Raid {
  const worth = (d: MonsterOnBoard) =>
    monsterValue(d) + BOOST_TARGET_FACTOR * teamBoost(d, defenderZones);
  const alive = defenderZones
    .filter((d) => d !== null)
    .sort((a, b) => worth(b) - worth(a));
  const out: Raid = { primes: 0, destroyed: [] };
  const sorted = [...attackers].sort(
    (a, b) => effectiveAtk(b.m) - effectiveAtk(a.m),
  );
  for (const { m, attacks } of sorted) {
    for (let n = 0; n < attacks; n++) {
      if (alive.length === 0) {
        if (directAllowed) out.primes += 1;
        continue;
      }
      const taunts = alive.filter((d) => d.hasTaunt);
      const pool = taunts.length > 0 && !m.ignoresTaunt ? taunts : alive;
      const killable = pool.filter((d) => damageTo(d, m) >= d.currentHp);
      const safe = killable.filter(
        (d) => d.mode === 'guard' || damageTo(m, d) < m.currentHp,
      );
      const target =
        safe.find((d) => d.mode === 'attack' || m.hasPiercing) ?? safe[0];
      if (!target) break;
      if (target.mode === 'attack' || m.hasPiercing) out.primes += 1;
      out.destroyed.push(target);
      alive.splice(alive.indexOf(target), 1);
    }
  }
  return out;
}

const BOOST_ACTIONS = new Set<string>([
  ActionType.BUFF_ATK,
  ActionType.BUFF_HP,
  ActionType.BUFF_ATK_TEMP,
  ActionType.HEAL,
]);
const BOOST_TRIGGERS = new Set<string>([
  EffectTrigger.PASSIVE,
  EffectTrigger.ON_BATTLE_PHASE_START,
  EffectTrigger.ON_TURN_START,
]);
const TEAM_TARGETS = new Set<string>([
  EffectTarget.ALL_ALLIES,
  EffectTarget.ALLIES_EXCEPT_SELF,
  EffectTarget.ARCHETYPE_ALLIES,
  EffectTarget.ADJACENT_ALLIES,
]);

/**
 * Bonus que `m` donne à ses alliés (ATK, PV, soin) : somme des valeurs de ses
 * effets d'équipe, multipliée par le nombre d'alliés qu'ils touchent.
 */
export function teamBoost(
  m: MonsterOnBoard,
  zones: readonly (MonsterOnBoard | null)[],
): number {
  const zone = zones.indexOf(m);
  const others = zones.filter((z) => z && z !== m).length;
  const adjacent = [zone - 1, zone + 1].filter((i) => zones[i]).length;
  let boost = 0;
  for (const effect of m.card.baseCard.effects ?? []) {
    if (!BOOST_TRIGGERS.has(effect.trigger)) continue;
    for (const a of effect.actions) {
      if (!BOOST_ACTIONS.has(a.type) || !TEAM_TARGETS.has(a.target)) continue;
      const reach =
        a.target === EffectTarget.ADJACENT_ALLIES ? adjacent : others;
      boost += (a.value ?? 0) * reach;
    }
  }
  return boost;
}

/** Bonus d'équipe qui vaut un poids « à protéger » de 1. */
const BOOST_PER_PROTECT = 200;

/** Poids d'un monstre à protéger selon l'archétype. */
function protectWeight(
  m: MonsterOnBoard,
  zones: readonly (MonsterOnBoard | null)[],
  archetype: AdventureArchetype,
): number {
  if (archetype === 'pixelman') return m.equipments.length;
  if (archetype === 'dragon' && isGrowing(m)) return 1;
  // Pipou : garder en vie ceux qui boostent les autres
  if (archetype === 'pipou')
    return Math.min(2, teamBoost(m, zones) / BOOST_PER_PROTECT);
  return 0;
}

/**
 * Score de l'état pour `seat` : Primes (fort poids), terrain, main, risque au
 * tour adverse, plus un bonus propre à l'archétype. ±Infinity en fin de partie.
 */
export function evaluate(
  game: GameState,
  seat: Seat,
  archetype: AdventureArchetype,
): number {
  const me = seatPlayer(game, seat);
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');

  if (game.phase === 'finished') {
    if (game.winner === me.userId) return Infinity;
    if (game.winner === opp.userId) return -Infinity;
    return -PRIME * 10;
  }

  let score = (opp.primes - me.primes) * PRIME;

  for (const c of me.hand)
    score += HAND_CARD_BASE + 0.1 * cardUsefulness(c.baseCard);
  score += ENERGY_VALUE * me.recycleEnergy;
  score += TERRAIN_VALUE * me.supportZones.filter(Boolean).length;
  score -= TERRAIN_VALUE * opp.supportZones.filter(Boolean).length;

  const mine = me.monsterZones.filter((m) => m !== null);
  const theirs = opp.monsterZones.filter((m) => m !== null);

  // Un Zeta implanté appartient à son poseur : il ne compte pas dans le plateau
  // de l'hôte, ne l'attaque pas, ne protège pas et ne se frappe pas en combat
  // normal (sa Prime est portée par le compteur de tour ; son virus par effectiveAtk).
  const ownZones = (host: typeof me) =>
    host.monsterZones.map((m) =>
      m && !isImplanted(m, host.userId) ? m : null,
    );
  const myZones = ownZones(me);
  const oppZones = ownZones(opp);
  const myBoard = myZones.filter((m) => m !== null);
  const oppBoard = oppZones.filter((m) => m !== null);

  // Compteurs de tour : la Prime va à celui qui a posé le monstre
  for (const [host, list] of [
    [me, mine],
    [opp, theirs],
  ] as const)
    for (const m of list)
      if (m.turnCounter !== undefined)
        score +=
          (m.ownerUserId ?? host.userId) === me.userId
            ? COUNTER_PRIME
            : -COUNTER_PRIME;

  for (const m of myBoard) score += monsterValue(m);
  for (const m of oppBoard) score -= monsterValue(m);

  // Tour adverse : il peut repasser ses monstres en mode ATK
  const threat = raid(
    oppBoard
      .filter((m) => !isEgg(m) && !blocked(m) && !m.guardLocked)
      .map((m) => ({ m, attacks: m.attacksPerTurn })),
    myZones,
    true,
  );
  score -= THREAT_PRIME * threat.primes;
  for (const d of threat.destroyed)
    score -=
      monsterValue(d) / 2 +
      PROTECT_PENALTY * protectWeight(d, myZones, archetype);

  // Mon tour, avant le combat : Primes encore à prendre
  if (game.currentTurnUserId === me.userId && game.phase === 'main') {
    const potential = raid(
      myBoard
        .map((m) => ({ m, attacks: hasAttacksLeft(m) }))
        .filter((a) => a.attacks > 0),
      oppZones,
      game.turnNumber > 1,
    );
    score += POTENTIAL_PRIME * potential.primes;
  }

  return score + archetypeBonus(myBoard, archetype);
}

/**
 * Pipou : nombre de monstres (l'union fait la force).
 * Pixelman : équipements du monstre le plus équipé (le noyau).
 * Drakon : stades cumulés et PV des unités en croissance.
 */
function archetypeBonus(
  mine: MonsterOnBoard[],
  archetype: AdventureArchetype,
): number {
  switch (archetype) {
    case 'pipou':
      return PIPOU_PER_MONSTER * mine.length;
    case 'pixelman':
      return (
        PIXELMAN_CORE_PRESENCE * Math.min(1, mine.filter(isCore).length) +
        PIXELMAN_PER_EQUIPMENT *
          Math.max(
            0,
            // Un monstre qui va s'autodétruire n'est pas un bon porteur
            ...mine
              .filter((m) => m.turnCounter === undefined)
              .map(
                (m) =>
                  m.equipments.length * (isCore(m) ? PIXELMAN_CORE_FACTOR : 1),
              ),
          )
      );
    case 'dragon':
      return mine.reduce(
        (sum, m) =>
          sum +
          DRAGON_PER_STAGE * (STAGE_RANK[m.card.baseCard.stage ?? ''] ?? 0) +
          (isGrowing(m) ? DRAGON_GROWING_HP * Math.max(0, m.currentHp) : 0),
        0,
      );
  }
}
