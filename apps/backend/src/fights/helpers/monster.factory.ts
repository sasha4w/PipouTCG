import { v4 as uuidv4 } from 'uuid';
import {
  CardInstance,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';

/** Monstre fraîchement posé sur le terrain, sans aucun effet appliqué. */
export function createMonsterOnBoard(
  card: CardInstance,
  opts: { ownerUserId?: number; instanceId?: string } = {},
): MonsterOnBoard {
  return {
    instanceId: opts.instanceId ?? uuidv4(),
    card,
    currentHp: card.baseCard.hp,
    mode: 'attack',
    equipments: [],
    atkBuff: 0,
    hpBuff: 0,
    tempAtkBuff: 0,
    perm: {
      atk: 0,
      hp: 0,
      taunt: false,
      piercing: false,
      debuffImmune: false,
      attacksPerTurn: 1,
    },
    hasAttackedThisTurn: false,
    attacksPerTurn: 1,
    attacksUsedThisTurn: 0,
    hasTaunt: false,
    hasPiercing: false,
    isImmuneToDebuffs: false,
    forcedAttackMode: false,
    summonedThisTurn: true,
    doubleAtkNextTurn: false,
    extraAttacksThisTurn: 0,
    cannotAttackOnSummonTurn: false,
    turnCounter: undefined,
    ownerUserId: opts.ownerUserId,
  };
}
