import { Injectable } from '@nestjs/common';
import {
  PlayerGameState,
  MonsterOnBoard,
} from './interfaces/game-state.interface';
import {
  ActionType,
  EffectTarget,
  EffectTrigger,
} from '../cards/interfaces/card-effect.interface';
import { SupportType } from '../cards/enums/support-type.enum';

@Injectable()
export class BuffsCalculatorService {
  recalculate(player: PlayerGameState): void {
    // 1. Reset buffs
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      zone.atkBuff = 0;
      zone.hpBuff = 0;
      // tempAtkBuff intentionnellement NON resetté ici — géré en fin de tour
    }

    // 2. Terrain
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

    // 3. Equipment
    for (const zone of player.monsterZones) {
      if (!zone) continue;

      for (const equipment of zone.equipments) {
        const effects = equipment.baseCard.effects;
        if (!effects) continue;

        for (const effect of effects) {
          if (effect.trigger !== EffectTrigger.PASSIVE) continue;

          for (const action of effect.actions) {
            if (action.type === ActionType.BUFF_ATK) {
              zone.atkBuff += action.value ?? 0;
            }
            if (action.type === ActionType.BUFF_HP) {
              zone.hpBuff += action.value ?? 0;
            }
          }
        }
      }
    }

    // 4. Monster self passive
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
