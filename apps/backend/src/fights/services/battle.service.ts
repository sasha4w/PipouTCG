import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameState } from '../interfaces/game-state.interface';
import { EffectTrigger } from '../../cards/interfaces/card-effect.interface';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';
import {
  addLog,
  getPlayerState,
  getOpponentState,
  isCurrentPlayer,
  applyDamage,
  gainPrime,
  removeMonster,
  drawCard,
} from '../helpers/game-state.helper';

@Injectable()
export class BattleService {
  constructor(
    private effectsResolver: EffectsResolverService,
    private buffsCalc: BuffsCalculatorService,
  ) {}

  async attack(
    game: GameState,
    userId: number,
    attackerInstanceId: string,
    targetInstanceId: string | undefined,
    direct: boolean,
    server: Server,
    checkWinAndEmit: (game: GameState, server: Server) => Promise<void>,
  ): Promise<{ error?: string }> {
    if (!isCurrentPlayer(game, userId)) return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'battle') return { error: 'Phase de combat uniquement' };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);

    const attacker = player.monsterZones.find((m) => m?.instanceId === attackerInstanceId);
    if (!attacker) return { error: 'Attaquant introuvable' };
    if (attacker.mode !== 'attack') return { error: 'Monstre en mode Garde' };

    if (attacker.summonedThisTurn && attacker.card.baseCard.id === 9)
      return { error: "Commandant Quenouille ne peut pas attaquer son tour d'invocation" };

    const maxAttacks = attacker.attacksPerTurn ?? 1;
    if (attacker.attacksUsedThisTurn >= maxAttacks)
      return { error: 'Ce monstre a déjà utilisé toutes ses attaques ce tour' };

    if (!direct) {
      const tauntMonsters = opponent.monsterZones.filter((m) => m?.hasTaunt);
      if (tauntMonsters.length > 0 && !tauntMonsters.find((m) => m?.instanceId === targetInstanceId))
        return { error: '⚠️ Vous devez attaquer le monstre avec Provocation !' };
    }

    attacker.attacksUsedThisTurn += 1;
    attacker.hasAttackedThisTurn = attacker.attacksUsedThisTurn >= (attacker.attacksPerTurn ?? 1);

    if (direct) {
      if (game.turnNumber === 1) return { error: 'Attaque directe interdite au premier tour' };
      if (opponent.monsterZones.some((z) => z !== null))
        return { error: "Attaque directe impossible : l'adversaire a des monstres" };

      const onAttackLog: string[] = [];
      this.effectsResolver.resolve(attacker.card, EffectTrigger.ON_ATTACK, {
        game, ownerUserId: userId, sourceMonster: attacker, log: onAttackLog,
      });
      onAttackLog.forEach((l) => addLog(game, l));

      gainPrime(game, userId, attacker.card.baseCard.name);
      await checkWinAndEmit(game, server);
      return {};
    }

    // Monster vs Monster
    const attackerAtk = attacker.card.baseCard.atk + attacker.atkBuff + (attacker.tempAtkBuff ?? 0);

    const onAttackLog: string[] = [];
    this.effectsResolver.resolve(attacker.card, EffectTrigger.ON_ATTACK, {
      game, ownerUserId: userId, sourceMonster: attacker, log: onAttackLog,
    });
    onAttackLog.forEach((l) => addLog(game, l));

    if (!targetInstanceId) return { error: 'Cible requise' };
    const target = opponent.monsterZones.find((m) => m?.instanceId === targetInstanceId);
    if (!target) return { error: 'Cible introuvable' };

    const targetAtk = target.card.baseCard.atk + target.atkBuff;

    const onDefendLog: string[] = [];
    this.effectsResolver.resolve(target.card, EffectTrigger.ON_DEFEND, {
      game, ownerUserId: opponent.userId, sourceMonster: target, targetMonster: attacker, log: onDefendLog,
    });
    onDefendLog.forEach((l) => addLog(game, l));

    if (target.mode === 'attack') {
      applyDamage(attacker, targetAtk);
      applyDamage(target, attackerAtk);

      const aDied = attacker.currentHp <= 0;
      const tDied = target.currentHp <= 0;

      if (aDied && tDied) {
        addLog(game, `⚔️ Double KO ! ${attacker.card.baseCard.name} & ${target.card.baseCard.name} — chacun récupère une Prime`);
        removeMonster(player, attackerInstanceId, game, this.effectsResolver);
        removeMonster(opponent, targetInstanceId, game, this.effectsResolver);
        gainPrime(game, userId, attacker.card.baseCard.name);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
        drawCard(game, userId);
        drawCard(game, opponent.userId);
      } else if (tDied) {
        addLog(game, `⚔️ ${attacker.card.baseCard.name} détruit ${target.card.baseCard.name}`);
        removeMonster(opponent, targetInstanceId, game, this.effectsResolver);
        gainPrime(game, userId, attacker.card.baseCard.name);
        drawCard(game, opponent.userId);
      } else if (aDied) {
        addLog(game, `⚔️ ${target.card.baseCard.name} détruit ${attacker.card.baseCard.name}`);
        removeMonster(player, attackerInstanceId, game, this.effectsResolver);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
        drawCard(game, userId);
      } else {
        addLog(game, `⚔️ Duel : ${attacker.card.baseCard.name} (${attacker.currentHp}HP) vs ${target.card.baseCard.name} (${target.currentHp}HP)`);
      }
    } else {
      // ATK vs GUARD
      applyDamage(target, attackerAtk);

      if (target.currentHp <= 0) {
        removeMonster(opponent, targetInstanceId, game, this.effectsResolver);
        drawCard(game, opponent.userId);
        if (attacker.hasPiercing) {
          gainPrime(game, userId, attacker.card.baseCard.name);
          addLog(game, `⚔️ Attaque Perçante ! ${attacker.card.baseCard.name} perce la Garde et gagne une Prime`);
        } else {
          addLog(game, `🛡️ ${attacker.card.baseCard.name} brise la Garde de ${target.card.baseCard.name} — aucune Prime`);
        }
      } else {
        addLog(game, `🛡️ ${attacker.card.baseCard.name} attaque ${target.card.baseCard.name} (${target.currentHp}HP) — Garde tient`);
      }
    }

    this.buffsCalc.recalculate(player);
    this.buffsCalc.recalculate(opponent);

    await checkWinAndEmit(game, server);
    return {};
  }
}
