import { Injectable } from '@nestjs/common';
import {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { EffectTrigger } from '@pipou/shared';
import { EffectsResolverService } from '../effects-resolver.service';
import {
  addLog,
  getPlayerState,
  getOpponentState,
  isCurrentPlayer,
  applyDamage,
  effectiveAtk,
  gainPrime,
  drawCard,
} from '../helpers/game-state.helper';

@Injectable()
export class BattleService {
  constructor(private effectsResolver: EffectsResolverService) {}

  attack(
    game: GameState,
    userId: number,
    attackerInstanceId: string,
    targetInstanceId: string | undefined,
    direct: boolean,
  ): { error?: string } {
    // ── Validations communes ─────────────────────────────────────────────────
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'battle') return { error: 'Phase de combat uniquement' };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);

    const attacker = player.monsterZones.find(
      (m) => m?.instanceId === attackerInstanceId,
    );
    if (!attacker) return { error: 'Attaquant introuvable' };
    if (attacker.mode !== 'attack') return { error: 'Monstre en mode Garde' };

    if (attacker.summonedThisTurn && attacker.cannotAttackOnSummonTurn)
      return {
        error: `${attacker.card.baseCard.name} ne peut pas attaquer le tour de son invocation`,
      };

    const maxAttacks = attacker.attacksPerTurn + attacker.extraAttacksThisTurn;
    if (attacker.attacksUsedThisTurn >= maxAttacks)
      return { error: 'Ce monstre a déjà utilisé toutes ses attaques ce tour' };

    if (
      attacker.blockAttackTurns !== undefined &&
      attacker.blockAttackTurns > 0
    )
      return {
        error: `${attacker.card.baseCard.name} ne peut pas attaquer (bloqué encore ${attacker.blockAttackTurns} tour(s))`,
      };

    // ── Validations spécifiques au mode ─────────────────────────────────────
    if (direct) {
      if (game.turnNumber === 1)
        return { error: 'Attaque directe interdite au premier tour' };
      if (opponent.monsterZones.some((z) => z !== null))
        return {
          error:
            "Attaque directe impossible : détruisez d'abord les monstres adverses",
        };
    } else {
      const tauntMonsters = opponent.monsterZones.filter((m) => m?.hasTaunt);
      if (
        tauntMonsters.length > 0 &&
        !tauntMonsters.find((m) => m?.instanceId === targetInstanceId)
      )
        return {
          error: '⚠️ Vous devez attaquer le monstre avec Provocation !',
        };

      if (!targetInstanceId) return { error: 'Cible requise' };
      if (
        !opponent.monsterZones.some((m) => m?.instanceId === targetInstanceId)
      )
        return { error: 'Cible introuvable' };
    }

    attacker.attacksUsedThisTurn += 1;
    attacker.hasAttackedThisTurn = attacker.attacksUsedThisTurn >= maxAttacks;

    const log: string[] = [];
    const flush = () => log.splice(0).forEach((l) => addLog(game, l));
    const destroy = (host: PlayerGameState, m: MonsterOnBoard) =>
      this.effectsResolver.destroyMonster(game, host, m.instanceId, log, {
        draw: true,
      });

    // ── ON_ATTACK ────────────────────────────────────────────────────────────
    this.effectsResolver.resolve(attacker.card, EffectTrigger.ON_ATTACK, {
      game,
      ownerUserId: userId,
      sourceMonster: attacker,
      log,
    });
    flush();

    // ── Attaque directe ──────────────────────────────────────────────────────
    if (direct) {
      gainPrime(game, userId, attacker.card.baseCard.name);
      // L'adversaire perd une Prime : il pioche une carte
      drawCard(game, opponent.userId);
      return {};
    }

    // ── Monstre contre monstre ───────────────────────────────────────────────
    const target = opponent.monsterZones.find(
      (m) => m?.instanceId === targetInstanceId,
    );
    if (!target) {
      addLog(
        game,
        `💨 La cible a disparu : l'attaque de ${attacker.card.baseCard.name} se perd`,
      );
      return {};
    }

    if (target.guardLocked) {
      target.guardLocked = false;
      addLog(
        game,
        `🔓 ${target.card.baseCard.name} est libéré de son verrou de Garde`,
      );
    }

    this.effectsResolver.resolve(target.card, EffectTrigger.ON_DEFEND, {
      game,
      ownerUserId: opponent.userId,
      sourceMonster: target,
      targetMonster: attacker,
      log,
    });
    flush();
    if (
      !player.monsterZones.includes(attacker) ||
      !opponent.monsterZones.includes(target)
    )
      return {};

    // Lu après ON_DEFEND : les bonus de défense comptent
    const attackerAtk = effectiveAtk(attacker);
    const targetAtk = effectiveAtk(target);

    if (target.mode === 'attack') {
      applyDamage(attacker, targetAtk, { ignoreReduction: target.hasPiercing });
      applyDamage(target, attackerAtk, {
        ignoreReduction: attacker.hasPiercing,
      });

      const aDied = attacker.currentHp <= 0;
      const tDied = target.currentHp <= 0;

      if (aDied && tDied) {
        addLog(
          game,
          `⚔️ Double KO ! ${attacker.card.baseCard.name} & ${target.card.baseCard.name} — chacun récupère une Prime`,
        );
        destroy(player, attacker);
        destroy(opponent, target);
        gainPrime(game, userId, attacker.card.baseCard.name);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
      } else if (tDied) {
        addLog(
          game,
          `⚔️ ${attacker.card.baseCard.name} détruit ${target.card.baseCard.name}`,
        );
        destroy(opponent, target);
        gainPrime(game, userId, attacker.card.baseCard.name);
      } else if (aDied) {
        addLog(
          game,
          `⚔️ ${target.card.baseCard.name} détruit ${attacker.card.baseCard.name}`,
        );
        destroy(player, attacker);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
      } else {
        addLog(
          game,
          `⚔️ Duel : ${attacker.card.baseCard.name} (${attacker.currentHp}HP) vs ${target.card.baseCard.name} (${target.currentHp}HP)`,
        );
      }
    } else {
      // ATK contre Garde : pas de riposte
      applyDamage(target, attackerAtk, {
        ignoreReduction: attacker.hasPiercing,
      });

      if (target.currentHp <= 0) {
        destroy(opponent, target);
        if (attacker.hasPiercing) {
          gainPrime(game, userId, attacker.card.baseCard.name);
          addLog(
            game,
            `⚔️ Attaque Perçante ! ${attacker.card.baseCard.name} perce la Garde et gagne une Prime`,
          );
        } else {
          addLog(
            game,
            `🛡️ ${attacker.card.baseCard.name} brise la Garde de ${target.card.baseCard.name} — aucune Prime`,
          );
        }
      } else {
        addLog(
          game,
          `🛡️ ${attacker.card.baseCard.name} attaque ${target.card.baseCard.name} (${target.currentHp}HP) — Garde tient`,
        );
      }
    }

    flush();
    return {};
  }
}
