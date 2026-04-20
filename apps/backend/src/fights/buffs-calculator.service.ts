import { Injectable } from '@nestjs/common';
import { PlayerGameState, MonsterOnBoard } from './interfaces/game-state.interface';
import { ActionType, EffectTarget, EffectTrigger } from '../cards/interfaces/card-effect.interface';
import { SupportType } from '../cards/enums/support-type.enum';

/**
 * Recomputes ATK and HP buffs for all monsters of `player` based on:
 *  1. PASSIVE effects on the monster card itself
 *  2. Attached equipment cards (EQUIPMENT supports)
 *  3. Active terrain cards (TERRAIN supports)
 *
 * Call this after ANY board change: summon, death, equipment attachment,
 * terrain placement / removal, recycle.
 *
 * The method is pure-reset: it zeroes all buffs then rebuilds from scratch
 * to avoid double-stacking.
 */
@Injectable()
export class BuffsCalculatorService {
  recalculate(player: PlayerGameState): void {
    // 1. Zero out all buffs (keep currentHp independent — don't touch it here
    //    so persistent damage is preserved).
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      zone.atkBuff = 0;
      zone.hpBuff = 0;
    }

    // 2. Terrain bonuses: apply once to each monster on board
    for (const terrain of player.supportZones) {
      if (!terrain) continue;
      if (terrain.supportType !== SupportType.TERRAIN) continue;
      if (!terrain.effects) continue;

      for (const effect of terrain.effects) {
        if (effect.trigger !== EffectTrigger.PASSIVE) continue;
        for (const action of effect.actions) {
          const targets = this.resolveTerrainTargets(action.target, player);
          for (const monster of targets) {
            if (action.type === ActionType.BUFF_ATK) {
              monster.atkBuff += action.value ?? 0;
            } else if (action.type === ActionType.BUFF_HP) {
              monster.hpBuff += action.value ?? 0;
            }
          }
        }
      }
    }

    // 3. Equipment bonuses: each equipment applies only to its host monster
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      for (const equipment of zone.equipments) {
        if (!equipment.effects) continue;
        for (const effect of equipment.effects) {
          if (effect.trigger !== EffectTrigger.PASSIVE) continue;
          for (const action of effect.actions) {
            if (action.type === ActionType.BUFF_ATK) {
              zone.atkBuff += action.value ?? 0;
            } else if (action.type === ActionType.BUFF_HP) {
              zone.hpBuff += action.value ?? 0;
            }
          }
        }
      }
    }

    // 4. Self-PASSIVE effects on monster cards
    for (const zone of player.monsterZones) {
      if (!zone || !zone.card.effects) continue;
      for (const effect of zone.card.effects) {
        if (effect.trigger !== EffectTrigger.PASSIVE) continue;
        for (const action of effect.actions) {
          if (
            action.target !== EffectTarget.SELF &&
            action.target !== EffectTarget.ALL_ALLIES
          ) continue;
          if (action.type === ActionType.BUFF_ATK) {
            zone.atkBuff += action.value ?? 0;
          } else if (action.type === ActionType.BUFF_HP) {
            zone.hpBuff += action.value ?? 0;
          }
        }
      }
    }
  }

  private resolveTerrainTargets(
    target: EffectTarget,
    player: PlayerGameState,
  ): MonsterOnBoard[] {
    const monsters = player.monsterZones.filter(
      (m): m is MonsterOnBoard => m !== null,
    );

    switch (target) {
      case EffectTarget.ALL_ALLIES:
        return monsters;
      case EffectTarget.ARCHETYPE_ALLIES:
        // For terrain, apply to all monsters (archetype filtering needs context; skip here)
        return monsters;
      default:
        return [];
    }
  }
}
