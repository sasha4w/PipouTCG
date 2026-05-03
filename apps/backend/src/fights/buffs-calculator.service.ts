import { Injectable } from '@nestjs/common';
import {
  PlayerGameState,
  MonsterOnBoard,
} from './interfaces/game-state.interface';
import {
  ActionType,
  ConditionType,
  EffectTarget,
  EffectTrigger,
} from '../cards/interfaces/card-effect.interface';
import { SupportType } from '../cards/enums/support-type.enum';

@Injectable()
export class BuffsCalculatorService {
  recalculate(player: PlayerGameState): void {
    // 1. Reset numeric buffs (flags like hasTaunt, damageReduction are reset too
    //    so PASSIVE equipment effects re-apply cleanly each recalculation)
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      zone.atkBuff = 0;
      zone.hpBuff = 0;
      // tempAtkBuff intentionnellement NON resetté ici — géré en fin de tour

      // Reset flag passives — will be re-derived below from equipment effects
      zone.hasTaunt = false;
      zone.damageReduction = undefined;
    }

    // 2. Terrain PASSIVE
    for (const terrain of player.supportZones) {
      if (!terrain) continue;
      if (terrain.baseCard.supportType !== SupportType.TERRAIN) continue;

      const effects = terrain.baseCard.effects;
      if (!effects) continue;

      for (const effect of effects) {
        if (effect.trigger !== EffectTrigger.PASSIVE) continue;

        for (const action of effect.actions) {
          const targets = this.resolveTerrainTargets(action.target, player);

          for (const monster of targets) {
            if (action.type === ActionType.BUFF_ATK) {
              monster.atkBuff += action.value ?? 0;
            }
            if (action.type === ActionType.BUFF_HP) {
              monster.hpBuff += action.value ?? 0;
            }
          }
        }
      }
    }

    // 3. Equipment PASSIVE (with optional SPECIFIC_CARD_ON_BOARD condition)
    for (const zone of player.monsterZones) {
      if (!zone) continue;

      for (const equipment of zone.equipments) {
        const effects = equipment.baseCard.effects;
        if (!effects) continue;

        for (const effect of effects) {
          if (effect.trigger !== EffectTrigger.PASSIVE) continue;

          // Evaluate SPECIFIC_CARD_ON_BOARD condition in the context of this
          // equipment's host monster zone (the zone it is attached to).
          if (effect.condition?.type === ConditionType.SPECIFIC_CARD_ON_BOARD) {
            const requiredName = (
              effect.condition.value as string
            ).toLowerCase();
            const conditionMet = player.monsterZones.some(
              (m) => m && m.card.baseCard.name.toLowerCase() === requiredName,
            );
            if (!conditionMet) continue;
          }

          for (const action of effect.actions) {
            switch (action.type) {
              case ActionType.BUFF_ATK:
                zone.atkBuff += action.value ?? 0;
                break;
              case ActionType.BUFF_HP:
                zone.hpBuff += action.value ?? 0;
                break;
              // Flag passives driven by equipment
              case ActionType.SET_TAUNT:
                zone.hasTaunt = true;
                break;
              case ActionType.SET_DAMAGE_REDUCTION:
                // Take the strongest reduction if multiple equipments grant it
                zone.damageReduction =
                  zone.damageReduction === undefined
                    ? (action.value ?? 2)
                    : Math.max(zone.damageReduction, action.value ?? 2);
                break;
              case ActionType.SET_PIERCING:
                zone.hasPiercing = true;
                break;
            }
          }
        }
      }
    }

    // 4. Monster self PASSIVE
    for (const zone of player.monsterZones) {
      if (!zone) continue;

      const effects = zone.card.baseCard.effects;
      if (!effects) continue;

      for (const effect of effects) {
        if (effect.trigger !== EffectTrigger.PASSIVE) continue;

        for (const action of effect.actions) {
          if (
            action.target !== EffectTarget.SELF &&
            action.target !== EffectTarget.ALL_ALLIES
          )
            continue;

          if (action.type === ActionType.BUFF_ATK) {
            zone.atkBuff += action.value ?? 0;
          }
          if (action.type === ActionType.BUFF_HP) {
            zone.hpBuff += action.value ?? 0;
          }
          if (action.type === ActionType.SET_DAMAGE_REDUCTION) {
            zone.damageReduction =
              zone.damageReduction === undefined
                ? (action.value ?? 2)
                : Math.max(zone.damageReduction, action.value ?? 2);
          }
          if (action.type === ActionType.SET_TAUNT) {
            zone.hasTaunt = true;
          }
        }
      }
    }

    // 5. ARCHETYPE_ALLIES monster PASSIVE (e.g. Noyau Omega)
    for (const zone of player.monsterZones) {
      if (!zone) continue;

      const effects = zone.card.baseCard.effects;
      if (!effects) continue;

      for (const effect of effects) {
        if (effect.trigger !== EffectTrigger.PASSIVE) continue;

        for (const action of effect.actions) {
          if (action.target !== EffectTarget.ARCHETYPE_ALLIES) continue;

          const arch = zone.card.baseCard.archetype;
          if (!arch) continue;

          const archAllies = player.monsterZones.filter(
            (m): m is MonsterOnBoard =>
              m !== null &&
              m.instanceId !== zone.instanceId &&
              m.card.baseCard.archetype === arch,
          );

          for (const ally of archAllies) {
            if (action.type === ActionType.BUFF_ATK)
              ally.atkBuff += action.value ?? 0;
            if (action.type === ActionType.BUFF_HP)
              ally.hpBuff += action.value ?? 0;
          }
        }
      }
    }

    // 6. Adjacent ally bonus (Champion Ouille-Ouille)
    for (let idx = 0; idx < player.monsterZones.length; idx++) {
      const zone = player.monsterZones[idx];
      if (!zone) continue;
      const effects = zone.card.baseCard.effects;
      if (!effects) continue;

      for (const effect of effects) {
        if (effect.trigger !== EffectTrigger.PASSIVE) continue;
        for (const action of effect.actions) {
          if (action.type !== ActionType.BUFF_HP_PER_ADJACENT_ALLY) continue;

          const left = idx > 0 ? player.monsterZones[idx - 1] : null;
          const right =
            idx < player.monsterZones.length - 1
              ? player.monsterZones[idx + 1]
              : null;
          const adjacentCount = (left ? 1 : 0) + (right ? 1 : 0);
          zone.hpBuff += (action.value ?? 0) * adjacentCount;
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
      case EffectTarget.ARCHETYPE_ALLIES:
        return monsters;
      default:
        return [];
    }
  }
}
