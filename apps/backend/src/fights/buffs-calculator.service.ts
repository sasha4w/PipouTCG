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

/**
 * Détermine si un flag donné (ex: hasTaunt) est dérivé d'un effet PASSIF
 * sur la carte de base OU sur ses équipements.
 * Si oui → on peut le resetter avant de recalculer.
 * Si non → il a été posé par ON_SUMMON/ON_PLAY et doit persister.
 */
function flagComesfromPassive(
  zone: MonsterOnBoard,
  actionType: ActionType,
): boolean {
  const isPassiveOn = (effects: { trigger: string; actions: { type: string }[] }[] | null | undefined) =>
    effects?.some(
      (e) =>
        e.trigger === EffectTrigger.PASSIVE &&
        e.actions.some((a) => a.type === actionType),
    ) ?? false;

  if (isPassiveOn(zone.card.baseCard.effects)) return true;
  if (zone.equipments.some((eq) => isPassiveOn(eq.baseCard.effects))) return true;
  return false;
}

@Injectable()
export class BuffsCalculatorService {
  recalculate(player: PlayerGameState): void {
    // ── 1. Reset numeric buffs + flags PASSIFS uniquement ────────────────────
    //
    // Les buffs numériques (atkBuff, hpBuff) sont TOUJOURS recalculés depuis
    // zéro car ils viennent exclusivement de PASSIFS (terrains, équipements).
    //
    // Les flags booléens (hasTaunt, hasPiercing, etc.) NE sont resettés QUE
    // s'ils sont dérivés d'un PASSIF — sinon ils ont été posés par ON_SUMMON
    // ou ON_PLAY et doivent persister jusqu'à la mort du monstre.
    for (const zone of player.monsterZones) {
      if (!zone) continue;

      // Buffs numériques — toujours reset
      zone.atkBuff = 0;
      zone.hpBuff = 0;
      // tempAtkBuff intentionnellement NON resetté ici — géré en fin de tour

      // hasTaunt
      if (flagComesfromPassive(zone, ActionType.SET_TAUNT)) {
        zone.hasTaunt = false;
      }

      // hasPiercing
      if (flagComesfromPassive(zone, ActionType.SET_PIERCING)) {
        zone.hasPiercing = false;
      }

      // isImmuneToDebuffs
      if (flagComesfromPassive(zone, ActionType.SET_DEBUFF_IMMUNITY)) {
        zone.isImmuneToDebuffs = false;
      }

      // damageReduction
      if (flagComesfromPassive(zone, ActionType.SET_DAMAGE_REDUCTION)) {
        zone.damageReduction = undefined;
      }

      // attacksPerTurn — reset seulement si passif (rare mais possible)
      if (flagComesfromPassive(zone, ActionType.SET_ATTACKS_PER_TURN)) {
        zone.attacksPerTurn = 1;
      }
    }

    // ── 2. Terrain PASSIVE ───────────────────────────────────────────────────
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
            switch (action.type) {
              case ActionType.BUFF_ATK:
                monster.atkBuff += action.value ?? 0;
                break;
              case ActionType.BUFF_HP:
                monster.hpBuff += action.value ?? 0;
                break;
              case ActionType.SET_TAUNT:
                monster.hasTaunt = true;
                break;
              case ActionType.SET_PIERCING:
                monster.hasPiercing = true;
                break;
              case ActionType.SET_DEBUFF_IMMUNITY:
                monster.isImmuneToDebuffs = true;
                break;
              case ActionType.SET_DAMAGE_REDUCTION:
                monster.damageReduction =
                  monster.damageReduction === undefined
                    ? (action.value ?? 2)
                    : Math.max(monster.damageReduction, action.value ?? 2);
                break;
            }
          }
        }
      }
    }

    // ── 3. Equipment PASSIVE (avec condition optionnelle) ────────────────────
    for (const zone of player.monsterZones) {
      if (!zone) continue;

      for (const equipment of zone.equipments) {
        const effects = equipment.baseCard.effects;
        if (!effects) continue;

        for (const effect of effects) {
          if (effect.trigger !== EffectTrigger.PASSIVE) continue;

          // Évaluer la condition SPECIFIC_CARD_ON_BOARD
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
              case ActionType.SET_TAUNT:
                zone.hasTaunt = true;
                break;
              case ActionType.SET_PIERCING:
                zone.hasPiercing = true;
                break;
              case ActionType.SET_DEBUFF_IMMUNITY:
                zone.isImmuneToDebuffs = true;
                break;
              case ActionType.SET_DAMAGE_REDUCTION:
                zone.damageReduction =
                  zone.damageReduction === undefined
                    ? (action.value ?? 2)
                    : Math.max(zone.damageReduction, action.value ?? 2);
                break;
              case ActionType.SET_ATTACKS_PER_TURN:
                // Prend la valeur la plus élevée si plusieurs équipements
                zone.attacksPerTurn = Math.max(
                  zone.attacksPerTurn ?? 1,
                  action.value ?? 1,
                );
                break;
            }
          }
        }
      }
    }

    // ── 4. Monster self PASSIVE ──────────────────────────────────────────────
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

          switch (action.type) {
            case ActionType.BUFF_ATK:
              zone.atkBuff += action.value ?? 0;
              break;
            case ActionType.BUFF_HP:
              zone.hpBuff += action.value ?? 0;
              break;
            case ActionType.SET_TAUNT:
              zone.hasTaunt = true;
              break;
            case ActionType.SET_PIERCING:
              zone.hasPiercing = true;
              break;
            case ActionType.SET_DEBUFF_IMMUNITY:
              zone.isImmuneToDebuffs = true;
              break;
            case ActionType.SET_DAMAGE_REDUCTION:
              zone.damageReduction =
                zone.damageReduction === undefined
                  ? (action.value ?? 2)
                  : Math.max(zone.damageReduction, action.value ?? 2);
              break;
            case ActionType.SET_ATTACKS_PER_TURN:
              zone.attacksPerTurn = Math.max(
                zone.attacksPerTurn ?? 1,
                action.value ?? 1,
              );
              break;
          }
        }
      }
    }

    // ── 5. ARCHETYPE_ALLIES monster PASSIVE (ex: Noyau Omega) ───────────────
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
            switch (action.type) {
              case ActionType.BUFF_ATK:
                ally.atkBuff += action.value ?? 0;
                break;
              case ActionType.BUFF_HP:
                ally.hpBuff += action.value ?? 0;
                break;
              case ActionType.SET_TAUNT:
                ally.hasTaunt = true;
                break;
              case ActionType.SET_PIERCING:
                ally.hasPiercing = true;
                break;
            }
          }
        }
      }
    }

    // ── 6. Adjacent ally bonus (Champion Ouille-Ouille) ──────────────────────
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