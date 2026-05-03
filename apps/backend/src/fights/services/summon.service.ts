import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameState, MonsterOnBoard } from '../interfaces/game-state.interface';
import { CardType } from '../../cards/enums/cardtype.enum';
import { EffectTrigger } from '../../cards/interfaces/card-effect.interface';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';
import {
  addLog,
  getPlayerState,
  getOpponentState,
  isCurrentPlayer,
} from '../helpers/game-state.helper';
import { emitGameState } from '../helpers/client-state.builder';

/** Seul ID autorisé à être posé sur le terrain adverse */
const ZETA_CARD_ID = 122;

@Injectable()
export class SummonService {
  constructor(
    private effectsResolver: EffectsResolverService,
    private buffsCalc: BuffsCalculatorService,
  ) {}

  /** Invocation normale — pose sur le terrain du joueur courant */
  async summonMonster(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    server: Server,
  ): Promise<{ error?: string }> {
    return this.doSummon(
      game,
      userId,
      handIndex,
      zoneIndex,
      paymentHandIndices,
      false,
      server,
    );
  }

  /** Invocation Zeta — pose sur une zone adverse vide */
  async summonZetaOnOpponent(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    server: Server,
  ): Promise<{ error?: string }> {
    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };
    if (player.hand[handIndex].baseCard.id !== ZETA_CARD_ID)
      return { error: 'Seul Noyau Zeta peut être posé sur le terrain adverse' };

    return this.doSummon(
      game,
      userId,
      handIndex,
      zoneIndex,
      paymentHandIndices,
      true,
      server,
    );
  }

  // ── Logique commune ────────────────────────────────────────────────────────

  private async doSummon(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    onOpponentZone: boolean,
    server: Server,
  ): Promise<{ error?: string }> {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);
    const target = onOpponentZone ? opponent : player;

    if (zoneIndex < 0 || zoneIndex > 2) return { error: 'Zone invalide (0-2)' };
    if (target.monsterZones[zoneIndex]) return { error: 'Zone occupée' };
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const card = player.hand[handIndex];
    if (card.baseCard.type !== CardType.MONSTER)
      return { error: 'Pas un Monstre' };

    const isFree = player.freeSummonAvailable && card.baseCard.id === 29;
    if (isFree) player.freeSummonAvailable = false;

    const cost = isFree ? 0 : (card.baseCard.cost ?? 0);
    const uniquePayment = isFree ? [] : [...new Set(paymentHandIndices)];
    const handPayNeeded = isFree ? 0 : Math.max(0, cost - player.recycleEnergy);

    if (uniquePayment.length < handPayNeeded)
      return {
        error: `Pas assez de cartes défaussées (besoin: ${handPayNeeded})`,
      };
    if (uniquePayment.includes(handIndex))
      return { error: 'La carte invoquée ne peut pas payer son propre coût' };
    for (const i of uniquePayment) {
      if (i < 0 || i >= player.hand.length)
        return { error: `Index de paiement invalide: ${i}` };
    }

    const recycleUsed = Math.min(player.recycleEnergy, cost);
    player.recycleEnergy -= recycleUsed;

    const sortedPay = [...uniquePayment].sort((a, b) => b - a);
    for (let i = 0; i < handPayNeeded; i++) {
      const [discarded] = player.hand.splice(sortedPay[i], 1);
      player.graveyard.push(discarded);
    }

    const removedBefore = sortedPay.filter(
      (i, n) => i < handIndex && n < handPayNeeded,
    ).length;
    const [monster] = player.hand.splice(handIndex - removedBefore, 1);

    const instance: MonsterOnBoard = {
      instanceId: uuidv4(),
      card: monster,
      currentHp: monster.baseCard.hp,
      mode: 'attack',
      equipments: [],
      atkBuff: 0,
      hpBuff: 0,
      tempAtkBuff: 0,
      hasAttackedThisTurn: false,
      attacksPerTurn: 1,
      attacksUsedThisTurn: 0,
      hasTaunt: false,
      hasPiercing: false,
      isImmuneToDebuffs: false,
      forcedAttackMode: false,
      summonedThisTurn: true,
      doubleAtkNextTurn: false,
      turnCounter: undefined,
      // Mémorise le poseur quand c'est une zone adverse (Zeta)
      ownerUserId: onOpponentZone ? userId : undefined,
    };

    target.monsterZones[zoneIndex] = instance;

    addLog(
      game,
      onOpponentZone
        ? `🦠 ${player.username} implante ${monster.baseCard.name} sur le terrain de ${opponent.username} !`
        : `${player.username} invoque ${monster.baseCard.name} (${monster.baseCard.atk}ATK / ${monster.baseCard.hp}HP)`,
    );

    const summonLog: string[] = [];
    this.effectsResolver.resolve(monster, EffectTrigger.ON_SUMMON, {
      game,
      ownerUserId: userId,
      sourceMonster: instance,
      log: summonLog,
    });
    summonLog.forEach((l) => addLog(game, l));

    this.buffsCalc.recalculate(player);
    this.buffsCalc.recalculate(opponent);

    for (const handCard of player.hand) {
      const allyLog: string[] = [];
      this.effectsResolver.resolve(handCard, EffectTrigger.ON_ALLY_SUMMON, {
        game,
        ownerUserId: userId,
        log: allyLog,
      });
      allyLog.forEach((l) => addLog(game, l));
    }

    emitGameState(game, server);
    return {};
  }
}
