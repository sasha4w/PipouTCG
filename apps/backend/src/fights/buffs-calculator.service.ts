import { Injectable } from '@nestjs/common';
import {
  ActionType,
  EffectTarget,
  EffectTrigger,
  SupportType,
} from '@pipou/shared';
import type { CardEffect, EffectAction } from '@pipou/shared';
import {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from './interfaces/game-state.interface';
import type { EffectContext } from './effects/effect-context.interface';
import { checkCondition } from './effects/effect-conditions';

/**
 * Recalcule les valeurs effectives des monstres : on repart des bonus
 * permanents (effets déclenchés), puis on applique les passifs actifs
 * (terrains, équipements, monstres) dont la condition est remplie.
 */
@Injectable()
export class BuffsCalculatorService {
  recalculate(game: GameState): void {
    for (const player of [game.player1, game.player2]) {
      this.recalculatePlayer(game, player);
    }
  }

  private recalculatePlayer(game: GameState, player: PlayerGameState): void {
    const monsters = player.monsterZones.filter(
      (m): m is MonsterOnBoard => m !== null,
    );
    const previousMaxHp = new Map(monsters.map((m) => [m, maxHp(m)]));
    const ctx = (
      sourceCard: CardInstance,
      sourceMonster?: MonsterOnBoard,
    ): EffectContext => ({
      game,
      ownerUserId: player.userId,
      sourceCard,
      sourceMonster,
      log: [],
    });

    // 1. Socle : bonus permanents
    for (const m of monsters) {
      m.atkBuff = m.perm.atk;
      m.hpBuff = m.perm.hp;
      m.hasTaunt = m.perm.taunt;
      m.hasPiercing = m.perm.piercing;
      m.isImmuneToDebuffs = m.perm.debuffImmune;
      m.damageReduction = m.perm.damageReduction;
      m.attacksPerTurn = m.perm.attacksPerTurn;
    }

    // 2. Terrains : uniquement les monstres de leur propriétaire
    for (const terrain of player.supportZones) {
      if (!terrain || terrain.baseCard.supportType !== SupportType.TERRAIN)
        continue;
      for (const eff of passiveEffects(terrain)) {
        if (!checkCondition(eff, ctx(terrain))) continue;
        for (const action of eff.actions) {
          for (const m of terrainTargets(action, terrain, monsters))
            applyPassive(m, action);
        }
      }
    }

    // 3. Équipements : SELF = le porteur
    for (const host of monsters) {
      for (const equipment of host.equipments) {
        for (const eff of passiveEffects(equipment)) {
          if (!checkCondition(eff, ctx(equipment, host))) continue;
          for (const action of eff.actions) {
            if (action.target === EffectTarget.SELF) applyPassive(host, action);
          }
        }
      }
    }

    // 4. Passifs des monstres
    player.monsterZones.forEach((source, idx) => {
      if (!source) return;
      for (const eff of passiveEffects(source.card)) {
        if (!checkCondition(eff, ctx(source.card, source))) continue;
        for (const action of eff.actions) {
          if (action.type === ActionType.BUFF_HP_PER_ADJACENT_ALLY) {
            const adjacent = [
              player.monsterZones[idx - 1],
              player.monsterZones[idx + 1],
            ].filter(Boolean).length;
            source.hpBuff += (action.value ?? 0) * adjacent;
            continue;
          }
          for (const m of monsterTargets(action, source, monsters))
            applyPassive(m, action);
        }
      }
    });

    // 5. Les PV courants suivent la variation des PV max, sans les dépasser
    for (const m of monsters) {
      const after = maxHp(m);
      m.currentHp = Math.min(
        m.currentHp + (after - previousMaxHp.get(m)!),
        after,
      );
    }
  }
}

function maxHp(m: MonsterOnBoard): number {
  return m.card.baseCard.hp + m.hpBuff;
}

function passiveEffects(card: CardInstance): CardEffect[] {
  return (card.baseCard.effects ?? []).filter(
    (e) => e.trigger === EffectTrigger.PASSIVE,
  );
}

function terrainTargets(
  action: EffectAction,
  terrain: CardInstance,
  monsters: MonsterOnBoard[],
): MonsterOnBoard[] {
  switch (action.target) {
    case EffectTarget.ALL_ALLIES:
      return monsters;
    case EffectTarget.ARCHETYPE_ALLIES: {
      const arch = action.archetype ?? terrain.baseCard.archetype;
      return arch
        ? monsters.filter((m) => m.card.baseCard.archetype === arch)
        : [];
    }
    default:
      return [];
  }
}

function monsterTargets(
  action: EffectAction,
  source: MonsterOnBoard,
  monsters: MonsterOnBoard[],
): MonsterOnBoard[] {
  switch (action.target) {
    case EffectTarget.SELF:
      return [source];
    case EffectTarget.ALL_ALLIES:
      return monsters;
    case EffectTarget.ALLIES_EXCEPT_SELF:
      return monsters.filter((m) => m !== source);
    case EffectTarget.ARCHETYPE_ALLIES: {
      const arch = action.archetype ?? source.card.baseCard.archetype;
      return arch
        ? monsters.filter(
            (m) => m !== source && m.card.baseCard.archetype === arch,
          )
        : [];
    }
    default:
      return [];
  }
}

function applyPassive(m: MonsterOnBoard, action: EffectAction): void {
  switch (action.type) {
    case ActionType.BUFF_ATK:
      m.atkBuff += action.value ?? 0;
      break;
    case ActionType.BUFF_HP:
      m.hpBuff += action.value ?? 0;
      break;
    case ActionType.SET_TAUNT:
      m.hasTaunt = true;
      break;
    case ActionType.SET_PIERCING:
      m.hasPiercing = true;
      break;
    case ActionType.SET_DEBUFF_IMMUNITY:
      m.isImmuneToDebuffs = true;
      break;
    case ActionType.SET_DAMAGE_REDUCTION:
      m.damageReduction = Math.max(m.damageReduction ?? 1, action.value ?? 2);
      break;
    case ActionType.SET_ATTACKS_PER_TURN:
      m.attacksPerTurn = Math.max(m.attacksPerTurn, action.value ?? 1);
      break;
  }
}
