import {
  CardType,
  DrakonStage,
  HAND_LIMIT,
  SupportType,
  canEvolveNow,
  canEvolveOnto,
  canImplantOn,
  canSummonFromHand,
  canSummonOnEnemySide,
  ephemeralTargetSide,
  evolutionCost,
  isImplanted,
  isPlantedBy,
} from '@pipou/shared';
import type { GameAction, Seat } from '@pipou/shared';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PendingChoice,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { freshCandidates, seatPlayer } from '../helpers/game-state.helper';
import { cardUsefulness } from './evaluate';

/** Combinaisons de pick_cards examinées au plus (au-delà : trop de clones). */
const MAX_PICK_COMBOS = 12;

/**
 * Choix à résoudre en premier, sans modifier l'état (contrairement à
 * `currentChoice`, qui écarte les choix périmés).
 */
export function activeChoice(game: GameState): PendingChoice | undefined {
  return game.pendingChoices.find((c) => freshCandidates(game, c).length > 0);
}

const freeZones = (zones: readonly unknown[]): number[] =>
  zones.flatMap((z, i) => (z ? [] : [i]));

/** Premier index de main par carte de base : deux exemplaires donnent le même coup. */
function distinctHandIndices(hand: CardInstance[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  hand.forEach((c, i) => {
    if (seen.has(c.baseCard.id)) return;
    seen.add(c.baseCard.id);
    out.push(i);
  });
  return out;
}

/** Paiement minimal avec les cartes les moins utiles (null : pas assez de cartes). */
function cheapestPayment(
  hand: CardInstance[],
  exclude: number,
  needed: number,
): number[] | null {
  if (needed <= 0) return [];
  const others = hand
    .map((c, i) => ({ i, u: cardUsefulness(c.baseCard) }))
    .filter((x) => x.i !== exclude)
    .sort((a, b) => a.u - b.u);
  if (others.length < needed) return null;
  return others.slice(0, needed).map((x) => x.i);
}

/**
 * Actions plausibles du siège. Le moteur tranche ensuite leur validité :
 * la liste peut contenir des coups refusés, mais jamais en omettre un utile
 * de façon systématique.
 */
export function listCandidates(game: GameState, seat: Seat): GameAction[] {
  if (game.phase === 'finished' || game.phase === 'waiting') return [];
  const me = seatPlayer(game, seat);

  const choice = activeChoice(game);
  if (choice)
    return choice.forUserId === me.userId ? pickCandidates(game, choice) : [];

  if (game.phase === 'mulligan')
    return me.mulliganDone
      ? []
      : [
          { type: 'mulligan', redraw: false },
          { type: 'mulligan', redraw: true },
        ];

  if (game.currentTurnUserId !== me.userId) return [];
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');

  switch (game.phase) {
    case 'main':
      return [...mainCandidates(me, opp), { type: 'end_phase' }];
    case 'battle':
      return [...attackCandidates(me, opp), { type: 'end_phase' }];
    case 'end':
      if (me.hand.length > HAND_LIMIT)
        return distinctHandIndices(me.hand).map((handIndex) => ({
          type: 'discard',
          handIndex,
        }));
      return [{ type: 'end_phase' }];
    default:
      return [];
  }
}

function pickCandidates(game: GameState, choice: PendingChoice): GameAction[] {
  const fresh = freshCandidates(game, choice);
  const k = Math.min(choice.count, fresh.length);
  const combos: string[][] = [];
  const keys = new Set<string>();
  const add = (picked: typeof fresh) => {
    const key = picked
      .map((c) => c.baseCard.id)
      .sort((a, b) => a - b)
      .join(',');
    if (keys.has(key)) return;
    keys.add(key);
    combos.push(picked.map((c) => c.instanceId));
  };

  // Les plus et les moins utiles d'abord : garder le meilleur / défausser le pire
  const byUse = [...fresh].sort(
    (a, b) => cardUsefulness(b.baseCard) - cardUsefulness(a.baseCard),
  );
  add(fresh.slice(0, k));
  add(byUse.slice(0, k));
  add(byUse.slice(-k));

  // Puis les combinaisons dans l'ordre, jusqu'au plafond
  const idx = Array.from({ length: k }, (_, i) => i);
  for (let guard = 0; guard < 500 && combos.length < MAX_PICK_COMBOS; guard++) {
    add(idx.map((i) => fresh[i]));
    let p = k - 1;
    while (p >= 0 && idx[p] === fresh.length - k + p) p--;
    if (p < 0) break;
    idx[p]++;
    for (let q = p + 1; q < k; q++) idx[q] = idx[q - 1] + 1;
  }
  return combos.map((instanceIds) => ({ type: 'pick_cards', instanceIds }));
}

function mainCandidates(
  me: PlayerGameState,
  opp: PlayerGameState,
): GameAction[] {
  const out: GameAction[] = [];
  // Un Zeta implanté chez moi appartient à l'adversaire : ni mode, ni équipement, ni cible alliée
  const myMonsters = me.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && !isImplanted(m, me.userId),
  );
  // Mon propre Zeta, chez l'adversaire : je peux l'équiper
  const myPlanted = opp.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && isPlantedBy(m, me.userId),
  );
  const canPlant = canImplantOn(opp.monsterZones, me.userId);

  for (const handIndex of distinctHandIndices(me.hand)) {
    const card = me.hand[handIndex].baseCard;

    if (card.type === CardType.MONSTER) {
      if (canSummonFromHand(card)) {
        const free = me.freeSummonInstanceIds.includes(
          me.hand[handIndex].instanceId,
        );
        const needed = free ? 0 : Math.max(0, card.cost - me.recycleEnergy);
        const payment = cheapestPayment(me.hand, handIndex, needed);
        if (payment) {
          for (const zoneIndex of freeZones(me.monsterZones))
            out.push({
              type: 'summon',
              handIndex,
              zoneIndex,
              paymentHandIndices: payment,
            });
          if (canSummonOnEnemySide(card.effects) && canPlant)
            for (const zoneIndex of freeZones(opp.monsterZones))
              out.push({
                type: 'summon',
                handIndex,
                zoneIndex,
                paymentHandIndices: payment,
                onOpponentSide: true,
              });
        }
      }
      if (card.stage === DrakonStage.YOUNG || card.stage === DrakonStage.ADULT)
        for (const base of myMonsters) {
          if (!canEvolveOnto(card, base) || !canEvolveNow(base)) continue;
          const needed = Math.max(
            0,
            evolutionCost(card, base) - me.recycleEnergy,
          );
          const payment = cheapestPayment(me.hand, handIndex, needed);
          if (payment)
            out.push({
              type: 'evolve',
              handIndex,
              targetInstanceId: base.instanceId,
              paymentHandIndices: payment,
            });
        }
    }

    if (card.type === CardType.SUPPORT) {
      if (card.supportType === SupportType.EQUIPMENT)
        for (const m of [...myMonsters, ...myPlanted])
          out.push({
            type: 'play_support',
            handIndex,
            targetInstanceId: m.instanceId,
          });
      else if (card.supportType === SupportType.TERRAIN)
        for (const zoneIndex of freeZones(me.supportZones))
          out.push({ type: 'play_support', handIndex, zoneIndex });
      else {
        const side = ephemeralTargetSide(card.effects);
        if (!side) out.push({ type: 'play_support', handIndex });
        else
          for (const m of side === 'ally' ? myMonsters : opp.monsterZones)
            if (m)
              out.push({
                type: 'play_support',
                handIndex,
                targetInstanceId: m.instanceId,
              });
      }
    }

    out.push({ type: 'recycle', handIndex });
  }

  for (const m of myMonsters)
    out.push({
      type: 'change_mode',
      instanceId: m.instanceId,
      mode: m.mode === 'attack' ? 'guard' : 'attack',
    });
  return out;
}

function attackCandidates(
  me: PlayerGameState,
  opp: PlayerGameState,
): GameAction[] {
  const out: GameAction[] = [];
  // Mon Zeta chez l'adversaire n'est pas une cible et ne bloque pas l'attaque directe
  const targets = opp.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && !isPlantedBy(m, me.userId),
  );
  // Désinfection : un Zeta implanté chez moi se frappe sans riposte
  const infected = me.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && isImplanted(m, me.userId),
  );
  for (const m of me.monsterZones) {
    if (!m || m.mode !== 'attack' || isImplanted(m, me.userId)) continue;
    if (m.card.baseCard.stage === DrakonStage.EGG) continue;
    for (const z of infected)
      out.push({
        type: 'attack',
        attackerInstanceId: m.instanceId,
        targetInstanceId: z.instanceId,
      });
    for (const t of targets)
      out.push({
        type: 'attack',
        attackerInstanceId: m.instanceId,
        targetInstanceId: t.instanceId,
      });
    if (targets.length === 0)
      out.push({
        type: 'attack',
        attackerInstanceId: m.instanceId,
        direct: true,
      });
  }
  return out;
}
