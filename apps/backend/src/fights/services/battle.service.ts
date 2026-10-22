import { Injectable } from '@nestjs/common';
import {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import {
  DestroyCause,
  DrakonStage,
  EffectTrigger,
  isImplanted,
  isPlantedBy,
} from '@pipou/shared';
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

/** Dégâts de combat : rien sur un monstre insensible au combat. Renvoie les dégâts subis. */
function combatDamage(
  target: MonsterOnBoard,
  dmg: number,
  opts: { ignoreReduction?: boolean },
): number {
  if (target.combatImmune) return 0;
  return applyDamage(target, dmg, opts);
}

/** Renvoi de dégâts : `defender` renvoie une part des dégâts subis à `attacker`. */
function reflectDamage(
  defender: MonsterOnBoard,
  attacker: MonsterOnBoard,
  taken: number,
): void {
  if (!defender.reflectPercent || taken <= 0) return;
  combatDamage(
    attacker,
    Math.floor((taken * defender.reflectPercent) / 100),
    {},
  );
}

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
    if (isImplanted(attacker, userId))
      return {
        error: `${attacker.card.baseCard.name} appartient à ton adversaire`,
      };
    if (attacker.card.baseCard.stage === DrakonStage.EGG)
      return { error: 'Un Œuf ne peut pas attaquer' };
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

    // Désinfection : cible implantée chez soi par l'adversaire
    const infected =
      !direct && targetInstanceId
        ? player.monsterZones.find(
            (m) => m?.instanceId === targetInstanceId && isImplanted(m, userId),
          )
        : undefined;
    if (infected?.disinfectImmune)
      return {
        error: `${infected.card.baseCard.name} est protégé jusqu'au prochain tour de son poseur`,
      };
    if (
      !direct &&
      opponent.monsterZones.some(
        (m) =>
          !!m && m.instanceId === targetInstanceId && isPlantedBy(m, userId),
      )
    )
      return { error: 'Tu ne peux pas attaquer ton propre Zeta' };

    // ── Validations spécifiques au mode ─────────────────────────────────────
    if (infected) {
      // Ni Provocation ni cible adverse à vérifier : le Zeta est déjà chez soi
    } else if (direct) {
      if (game.turnNumber === 1)
        return { error: 'Attaque directe interdite au premier tour' };
      // Un monstre que j'ai moi-même implanté ne protège pas l'adversaire
      if (opponent.monsterZones.some((z) => z && !isPlantedBy(z, userId)))
        return {
          error:
            "Attaque directe impossible : détruisez d'abord les monstres adverses",
        };
    } else {
      const tauntMonsters = opponent.monsterZones.filter((m) => m?.hasTaunt);
      if (
        !attacker.ignoresTaunt &&
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
        cause: DestroyCause.COMBAT,
      });

    // ── ON_ATTACK ────────────────────────────────────────────────────────────
    this.effectsResolver.resolve(attacker.card, EffectTrigger.ON_ATTACK, {
      game,
      ownerUserId: userId,
      sourceMonster: attacker,
      log,
    });
    flush();

    // ── Désinfection : pas de riposte, ni Prime ni pioche ────────────────────
    if (infected) {
      combatDamage(infected, effectiveAtk(attacker), {
        ignoreReduction: attacker.hasPiercing,
      });
      if (infected.currentHp <= 0) {
        addLog(
          game,
          `🧹 ${attacker.card.baseCard.name} désinfecte ${infected.card.baseCard.name}`,
        );
        this.effectsResolver.destroyMonster(
          game,
          player,
          infected.instanceId,
          log,
          { draw: false, cause: DestroyCause.COMBAT },
        );
      } else {
        addLog(
          game,
          `🧹 ${attacker.card.baseCard.name} attaque ${infected.card.baseCard.name} (${infected.currentHp}HP)`,
        );
      }
      flush();
      return {};
    }

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
      combatDamage(attacker, targetAtk, {
        ignoreReduction: target.hasPiercing,
      });
      const taken = combatDamage(target, attackerAtk, {
        ignoreReduction: attacker.hasPiercing,
      });
      reflectDamage(target, attacker, taken);

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
      // ATK contre Garde : pas de riposte, mais le renvoi de dégâts s'applique
      const taken = combatDamage(target, attackerAtk, {
        ignoreReduction: attacker.hasPiercing,
      });
      reflectDamage(target, attacker, taken);
      if (attacker.currentHp <= 0) {
        // Tué par le renvoi d'un monstre en Garde : aucune Prime
        addLog(
          game,
          `🪞 ${target.card.baseCard.name} renvoie les coups : ${attacker.card.baseCard.name} est détruit`,
        );
        destroy(player, attacker);
      }

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
