import {
  ActionType,
  CardType,
  DrakonStage,
  EffectTarget,
  EffectTrigger,
  SupportType,
  canEvolveOnto,
  canSummonFromHand,
  ephemeralTargetSide,
  isImplanted,
  isPlantedBy,
  hasImmunity,
  Immunity,
} from '@pipou/shared';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import type {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { effectiveAtk, seatPlayer } from '../helpers/game-state.helper';
import { createMonsterOnBoard } from '../helpers/monster.factory';
import { ARCHETYPE_PROFILES } from './archetype-profiles';
import type { ArchetypeProfile } from './archetype-profiles';

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
/**
 * L'adversaire peut prendre toutes ses Primes restantes à son tour : une
 * estimation, donc sous la défaite certaine (-Infinity), mais au-dessus de
 * tout ce qu'un coup peut rapporter d'autre.
 */
const LETHAL_THREAT = PRIME * 4;
/** Prime que je peux encore prendre ce tour (phase principale). */
const POTENTIAL_PRIME = PRIME * 0.3;
/** Prime promise par un compteur de tour (Noyau Zeta). */
const COUNTER_PRIME = PRIME * 0.3;
/** Un tour de plus de virus (Zeta implanté) avant l'explosion. */
const VIRUS_TURN_VALUE = 150;
/** Surcoût d'un monstre « à protéger » (noyau équipé, Drakon en croissance). */
const PROTECT_PENALTY = PRIME * 0.3;

const STAGE_RANK: Record<string, number> = {
  [DrakonStage.EGG]: 1,
  [DrakonStage.BABY]: 2,
  [DrakonStage.YOUNG]: 3,
  [DrakonStage.ADULT]: 4,
  [DrakonStage.ANCESTRAL]: 5,
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
  return (
    !!stage && stage !== DrakonStage.ADULT && stage !== DrakonStage.ANCESTRAL
  );
}

/** Dégâts de combat réellement subis par `target`. */
function damageTo(target: MonsterOnBoard, attacker: MonsterOnBoard): number {
  if (hasImmunity(target, Immunity.COMBAT_DAMAGE)) return 0;
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
  /** Primes rendues au défenseur : attaquants sacrifiés dans un échange. */
  conceded: number;
}

/**
 * Estimation gloutonne d'une phase de combat. Une attaque ne compte que si
 * l'attaquant survit à la riposte. D'abord chaque attaquant, du plus fort au
 * plus faible, détruit seul une cible qu'il bat : celles qui rapportent une
 * Prime (mode ATK) d'abord, la plus précieuse en premier (stats + bonus
 * d'équipe). Puis les attaques restantes se regroupent sur une même cible
 * pour la détruire ensemble. Terrain vide : attaques directes.
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
  const out: Raid = { primes: 0, destroyed: [], conceded: 0 };
  // Une entrée par attaque disponible, du plus fort au plus faible
  const strikes = [...attackers]
    .sort((a, b) => effectiveAtk(b.m) - effectiveAtk(a.m))
    .flatMap(({ m, attacks }) => Array.from({ length: attacks }, () => m));
  const used = strikes.map(() => false);
  const canTarget = (m: MonsterOnBoard, d: MonsterOnBoard) =>
    d.hasTaunt || m.ignoresTaunt || !alive.some((x) => x.hasTaunt);
  const survives = (m: MonsterOnBoard, d: MonsterOnBoard) =>
    d.mode === 'guard' || damageTo(m, d) < m.currentHp;
  const destroy = (d: MonsterOnBoard, last: MonsterOnBoard) => {
    if (d.mode === 'attack' || last.hasPiercing) out.primes += 1;
    out.destroyed.push(d);
    alive.splice(alive.indexOf(d), 1);
  };

  // 1. Chacun seul
  strikes.forEach((m, i) => {
    if (alive.length === 0) return;
    const safe = alive.filter(
      (d) => canTarget(m, d) && damageTo(d, m) >= d.currentHp && survives(m, d),
    );
    const target =
      safe.find((d) => d.mode === 'attack' || m.hasPiercing) ?? safe[0];
    if (!target) return;
    used[i] = true;
    destroy(target, m);
  });

  // 2. À plusieurs sur une même cible
  for (let progress = true; progress && alive.length > 0;) {
    progress = false;
    const targets = [...alive].sort(
      (a, b) => Number(b.mode === 'attack') - Number(a.mode === 'attack'),
    );
    for (const d of targets) {
      const usable = (i: number) =>
        !used[i] && canTarget(strikes[i], d) && damageTo(d, strikes[i]) > 0;
      const group: number[] = [];
      let damage = 0;
      for (let i = 0; i < strikes.length && damage < d.currentHp; i++) {
        if (!usable(i) || !survives(strikes[i], d)) continue;
        group.push(i);
        damage += damageTo(d, strikes[i]);
      }
      // Il manque des dégâts : un échange, si la cible rapporte une Prime et
      // vaut plus que l'attaquant sacrifié (le moins précieux qui suffit)
      let sacrificed = -1;
      if (damage < d.currentHp && d.mode === 'attack')
        sacrificed =
          strikes
            .map((m, i) => ({ m, i }))
            .filter(
              ({ m, i }) =>
                usable(i) &&
                !survives(m, d) &&
                damage + damageTo(d, m) >= d.currentHp &&
                monsterValue(m) < worth(d),
            )
            .sort((a, b) => monsterValue(a.m) - monsterValue(b.m))[0]?.i ?? -1;
      if (damage < d.currentHp && sacrificed < 0) continue;
      if (sacrificed >= 0) {
        group.push(sacrificed);
        out.conceded += 1;
      }
      for (const i of group) used[i] = true;
      destroy(d, strikes[group[group.length - 1]]);
      progress = true;
      break;
    }
  }

  if (alive.length === 0 && directAllowed)
    out.primes += used.filter((u) => !u).length;
  return out;
}

/**
 * Monstres que `p` peut poser à son prochain tour depuis sa main, les plus
 * forts d'abord, tant qu'il a une zone libre et de quoi payer (il pioche une
 * carte avant). Sur l'état déterminisé, la main adverse est un tirage
 * plausible : l'IA ne voit pas la vraie.
 */
function reinforcements(p: PlayerGameState): MonsterOnBoard[] {
  let free = p.monsterZones.filter((z) => z === null).length;
  let cards = p.hand.length + 1;
  let energy = p.recycleEnergy;
  const out: MonsterOnBoard[] = [];
  const monsters = p.hand
    .filter(
      (c) =>
        c.baseCard.type === CardType.MONSTER && canSummonFromHand(c.baseCard),
    )
    .sort((a, b) => (b.baseCard.atk ?? 0) - (a.baseCard.atk ?? 0));
  for (const c of monsters) {
    if (free === 0) break;
    const cost = c.baseCard.cost ?? 0;
    const paid = Math.max(0, cost - energy);
    if (cards < 1 + paid) continue;
    cards -= 1 + paid;
    energy = Math.max(0, energy - cost);
    free -= 1;
    out.push(
      createMonsterOnBoard(c, {
        instanceId: `renfort:${c.instanceId}`,
        ownerUserId: p.userId,
      }),
    );
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

/** Poids d'un monstre à protéger selon la philosophie de l'archétype. */
function protectWeight(
  m: MonsterOnBoard,
  zones: readonly (MonsterOnBoard | null)[],
  profile: ArchetypeProfile,
): number {
  switch (profile.protect) {
    case 'equipments':
      return m.equipments.length;
    case 'growing':
      return isGrowing(m) ? 1 : 0;
    case 'boosters':
      // Garder en vie ceux qui boostent les autres
      return Math.min(2, teamBoost(m, zones) / BOOST_PER_PROTECT);
  }
}

/**
 * Ce que la main prépare : une évolution qui a une base, un équipement qui a
 * un porteur, un éphémère ciblé qui a une cible.
 */
export function handPotential(
  me: PlayerGameState,
  opp: PlayerGameState,
  profile: ArchetypeProfile,
): number {
  const allies = me.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && !isImplanted(m, me.userId),
  );
  const planted = opp.monsterZones.some(
    (m) => m !== null && isPlantedBy(m, me.userId),
  );
  const enemies = opp.monsterZones.some(
    (m) => m !== null && !isPlantedBy(m, me.userId),
  );
  let total = 0;
  for (const { baseCard: card } of me.hand) {
    if (
      card.stage === DrakonStage.YOUNG ||
      card.stage === DrakonStage.ADULT ||
      card.stage === DrakonStage.ANCESTRAL
    ) {
      if (allies.some((m) => canEvolveOnto(card, m)))
        total += profile.prepEvolve;
    } else if (card.supportType === SupportType.EQUIPMENT) {
      if (allies.length > 0 || planted) total += profile.prepEquip;
    } else if (card.supportType === SupportType.EPHEMERAL) {
      const side = ephemeralTargetSide(card.effects);
      if (
        (side === 'ally' && allies.length > 0) ||
        (side === 'enemy' && enemies)
      )
        total += profile.prepTarget;
    }
  }
  return total;
}

/** Morceaux du score, pour expliquer une décision (diagnostic). */
export type ScorePart =
  | 'primes'
  | 'hand'
  | 'energy'
  | 'terrains'
  | 'counters'
  | 'myBoard'
  | 'oppBoard'
  | 'threat'
  | 'potential'
  | 'archetype'
  | 'prepare';

/**
 * Score de l'état pour `seat` : Primes (fort poids), terrain, main, risque au
 * tour adverse, plus un bonus propre à l'archétype. ±Infinity en fin de partie.
 */
export function evaluate(
  game: GameState,
  seat: Seat,
  archetype: AdventureArchetype,
  /** Valeur de ce que la main prépare : le planificateur seulement (le glouton de l'aventure reste celui de l'étape 1). */
  prepare = false,
  /** Rempli avec le détail du score si fourni ; ne change pas le résultat. */
  parts?: Partial<Record<ScorePart, number>>,
): number {
  const me = seatPlayer(game, seat);
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
  const profile = ARCHETYPE_PROFILES[archetype];

  if (game.phase === 'finished') {
    if (game.winner === me.userId) return Infinity;
    if (game.winner === opp.userId) return -Infinity;
    return -PRIME * 10;
  }

  let score = 0;
  // Même ordre d'additions qu'avant : le score reste identique au bit près
  const add = parts
    ? (part: ScorePart, value: number) => {
        score += value;
        parts[part] = (parts[part] ?? 0) + value;
      }
    : (_part: ScorePart, value: number) => {
        score += value;
      };
  add('primes', (opp.primes - me.primes) * PRIME);

  for (const c of me.hand)
    add('hand', HAND_CARD_BASE + 0.1 * cardUsefulness(c.baseCard));
  add('energy', ENERGY_VALUE * me.recycleEnergy);
  add('terrains', TERRAIN_VALUE * me.supportZones.filter(Boolean).length);
  add('terrains', -TERRAIN_VALUE * opp.supportZones.filter(Boolean).length);

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
      if (m.turnCounter !== undefined) {
        // Chaque tour restant prolonge le virus pour le poseur
        const value = COUNTER_PRIME + VIRUS_TURN_VALUE * m.turnCounter;
        add(
          'counters',
          (m.ownerUserId ?? host.userId) === me.userId ? value : -value,
        );
      }

  for (const m of myBoard) add('myBoard', monsterValue(m));
  for (const m of oppBoard) add('oppBoard', -monsterValue(m));

  // Tour adverse : il peut repasser ses monstres en mode ATK, et poser des
  // renforts qui attaquent aussitôt
  const threat = raid(
    [...oppBoard, ...reinforcements(opp)]
      .filter((m) => !isEgg(m) && !blocked(m) && !m.guardLocked)
      .map((m) => ({ m, attacks: m.attacksPerTurn })),
    myZones,
    true,
  );
  const threatPrimes = threat.primes - threat.conceded;
  add('threat', -THREAT_PRIME * threatPrimes);
  // Assez de Primes pour qu'il gagne à son tour : c'est la défaite, pas 1 Prime
  if (threatPrimes > 0 && threatPrimes >= opp.primes)
    add('threat', -LETHAL_THREAT);
  for (const d of threat.destroyed)
    add(
      'threat',
      -(
        monsterValue(d) / 2 +
        PROTECT_PENALTY * protectWeight(d, myZones, profile)
      ),
    );

  // Mon tour, avant le combat : Primes encore à prendre
  if (game.currentTurnUserId === me.userId && game.phase === 'main') {
    const potential = raid(
      myBoard
        .map((m) => ({ m, attacks: hasAttacksLeft(m) }))
        .filter((a) => a.attacks > 0),
      oppZones,
      game.turnNumber > 1,
    );
    add('potential', POTENTIAL_PRIME * (potential.primes - potential.conceded));
  }

  add('archetype', archetypeBonus(myBoard, profile));
  if (prepare) add('prepare', handPotential(me, opp, profile));
  return score;
}

/**
 * Bonus de philosophie, même formule pour tous (poids nuls hors archétype) :
 * nombre de monstres, équipements du monstre le plus équipé (le Noyau),
 * stades cumulés et PV des unités en croissance.
 */
function archetypeBonus(mine: MonsterOnBoard[], p: ArchetypeProfile): number {
  const mostEquipped = Math.max(
    0,
    // Un monstre qui va s'autodétruire n'est pas un bon porteur
    ...mine
      .filter((m) => m.turnCounter === undefined)
      .map((m) => m.equipments.length * (isCore(m) ? p.coreFactor : 1)),
  );
  const growth = mine.reduce(
    (sum, m) =>
      sum +
      p.perStage * (STAGE_RANK[m.card.baseCard.stage ?? ''] ?? 0) +
      (isGrowing(m) ? p.growingHp * Math.max(0, m.currentHp) : 0),
    0,
  );
  return (
    p.perMonster * mine.length +
    p.corePresence * Math.min(1, mine.filter(isCore).length) +
    p.perEquipment * mostEquipped +
    growth
  );
}
