import { Injectable } from '@nestjs/common';
import {
  EffectTrigger,
  canEvolveNow,
  canEvolveOnto,
  isImplanted,
  evolutionCost,
} from '@pipou/shared';
import { GameState } from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from '../helpers/monster.factory';
import { EffectsResolverService } from '../effects-resolver.service';
import {
  addLog,
  getPlayerState,
  isCurrentPlayer,
  boardCard,
  sendToGraveyard,
} from '../helpers/game-state.helper';

@Injectable()
export class EvolutionService {
  constructor(private effectsResolver: EffectsResolverService) {}

  /** Fait évoluer un monstre allié avec un Drakon de la main (spec Drakon). */
  evolve(
    game: GameState,
    userId: number,
    handIndex: number,
    targetInstanceId: string,
    paymentHandIndices: number[],
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    const card = player.hand[handIndex];
    if (!card) return { error: 'Index main invalide' };
    const zoneIndex = player.monsterZones.findIndex(
      (m) => m?.instanceId === targetInstanceId,
    );
    const base = player.monsterZones[zoneIndex];
    if (!base) return { error: 'Monstre à faire évoluer introuvable' };
    if (isImplanted(base, userId))
      return {
        error: `${base.card.baseCard.name} appartient à ton adversaire`,
      };
    if (!canEvolveOnto(card.baseCard, base))
      return {
        error: `${card.baseCard.name} ne peut pas évoluer depuis ${base.card.baseCard.name}`,
      };
    if (!canEvolveNow(base))
      return {
        error: `${base.card.baseCard.name} doit attendre un tour avant d'évoluer`,
      };

    // Paiement : énergie de recyclage puis défausse (comme une invocation)
    const cost = evolutionCost(card.baseCard, base);
    const uniquePayment = [...new Set(paymentHandIndices)];
    const handPayNeeded = Math.max(0, cost - player.recycleEnergy);
    if (uniquePayment.length < handPayNeeded)
      return {
        error: `Pas assez de cartes défaussées (besoin: ${handPayNeeded})`,
      };
    if (uniquePayment.includes(handIndex))
      return { error: 'La carte qui évolue ne peut pas payer son propre coût' };
    for (const i of uniquePayment)
      if (i < 0 || i >= player.hand.length)
        return { error: `Index de paiement invalide: ${i}` };

    player.recycleEnergy -= Math.min(player.recycleEnergy, cost);
    const paid = [...uniquePayment]
      .sort((a, b) => b - a)
      .slice(0, handPayNeeded);
    for (const i of paid) player.graveyard.push(player.hand.splice(i, 1)[0]);
    const shift = paid.filter((i) => i < handIndex).length;
    const [evolvedCard] = player.hand.splice(handIndex - shift, 1);

    const evolved = createMonsterOnBoard(evolvedCard, {
      ownerUserId: base.ownerUserId,
    });
    evolved.equipments = base.equipments;
    evolved.mode = base.mode;
    // La Garde continue : même compteur, même verrou, même délai de retour
    evolved.guardTurns = base.guardTurns;
    evolved.guardLocked = base.guardLocked;
    evolved.guardCooldown = base.guardCooldown;
    // Compte comme posé ce tour : pas de réévolution immédiate (n'empêche pas d'attaquer)
    evolved.summonedThisTurn = true;
    evolved.attacksUsedThisTurn = base.attacksUsedThisTurn;
    evolved.hasAttackedThisTurn = base.hasAttackedThisTurn;

    sendToGraveyard(player, boardCard(base));
    player.monsterZones[zoneIndex] = evolved;
    game.pendingEvents.push({
      kind: 'monster_summoned',
      ownerId: player.userId,
      zoneIndex,
      instanceId: evolved.instanceId,
      rarity: evolvedCard.baseCard.rarity,
    });
    addLog(
      game,
      `🧬 ${base.card.baseCard.name} évolue en ${evolvedCard.baseCard.name}`,
    );

    const log: string[] = [];
    this.effectsResolver.resolve(evolvedCard, EffectTrigger.ON_SUMMON, {
      game,
      ownerUserId: userId,
      sourceMonster: evolved,
      log,
    });
    for (const handCard of player.hand)
      this.effectsResolver.resolve(handCard, EffectTrigger.ON_ALLY_SUMMON, {
        game,
        ownerUserId: userId,
        log,
      });
    log.forEach((l) => addLog(game, l));
    return {};
  }
}
