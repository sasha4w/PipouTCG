import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameState, MonsterOnBoard } from '../interfaces/game-state.interface';
import { addLog, getPlayerState, shuffle } from '../helpers/game-state.helper';
import { emitGameState } from '../helpers/client-state.builder';
import { EffectsResolverService } from '../effects-resolver.service';
import { EffectTrigger } from '../../cards/interfaces/card-effect.interface';

@Injectable()
export class PickService {
  constructor(private effectsResolver: EffectsResolverService) {}

  async pickCards(
    game: GameState,
    userId: number,
    instanceIds: string[],
    server: Server,
  ): Promise<{ error?: string }> {
    const choice = game.pendingChoice;
    if (!choice || choice.forUserId !== userId)
      return { error: 'Aucun choix de carte en attente' };

    const maxPick = Math.min(choice.count, choice.candidates.length);
    if (instanceIds.length !== maxPick)
      return { error: `Sélectionnez exactement ${maxPick} carte(s)` };

    for (const instanceId of instanceIds) {
      if (!choice.candidates.find((c) => c.instanceId === instanceId))
        return { error: `Carte introuvable dans les choix disponibles` };
    }

    const resolution = choice.resolution ?? 'pick_to_hand';

    switch (resolution) {
      case 'pick_to_hand':
        return this.resolvePickToHand(game, userId, instanceIds, server);
      case 'destroy_ally':
        return this.resolveDestroyAlly(game, userId, instanceIds, server);
      case 'return_to_hand':
        return this.resolveReturnToHand(game, userId, instanceIds, server);
      case 'force_attack_enemy':
        return this.resolveForceAttackEnemy(game, userId, instanceIds, server);
      default:
        return { error: `Résolution inconnue : ${resolution}` };
    }
  }

  // ── pick_to_hand — récupère depuis cimetière / deck ───────────────────────

  private async resolvePickToHand(
    game: GameState,
    userId: number,
    instanceIds: string[],
    server: Server,
  ): Promise<{ error?: string }> {
    const choice = game.pendingChoice!;
    const player = getPlayerState(game, userId);
    let pickedFromDeck = false;

    for (const instanceId of instanceIds) {
      const candidate = choice.candidates.find(
        (c) => c.instanceId === instanceId,
      )!;

      if (candidate.source === 'graveyard') {
        const idx = player.graveyard.findIndex(
          (c) => c.instanceId === instanceId,
        );
        if (idx !== -1) {
          const [card] = player.graveyard.splice(idx, 1);
          player.hand.push(card);
          addLog(
            game,
            `📥 ${player.username} récupère ${candidate.baseCard.name} depuis son cimetière`,
          );
        }
      } else {
        const idx = player.deck.findIndex((c) => c.instanceId === instanceId);
        if (idx !== -1) {
          const [card] = player.deck.splice(idx, 1);
          player.hand.push(card);
          pickedFromDeck = true;
          addLog(
            game,
            `🔮 ${player.username} récupère ${candidate.baseCard.name} depuis son deck`,
          );
        }
      }
    }

    if (pickedFromDeck) player.deck = shuffle([...player.deck]);

    game.pendingChoice = undefined;
    emitGameState(game, server);
    return {};
  }

  // ── destroy_ally — Formatage .exe, Recyclage .bat ─────────────────────────

  private async resolveDestroyAlly(
    game: GameState,
    userId: number,
    instanceIds: string[],
    server: Server,
  ): Promise<{ error?: string }> {
    const player = getPlayerState(game, userId);
    const [instanceId] = instanceIds;

    const zoneIdx = player.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (zoneIdx === -1) {
      game.pendingChoice = undefined;
      return { error: 'Monstre allié introuvable sur le terrain' };
    }

    const monster = player.monsterZones[zoneIdx]!;

    const log: string[] = [];
    this.effectsResolver.resolve(monster.card, EffectTrigger.ON_DEATH, {
      game,
      ownerUserId: userId,
      sourceMonster: monster,
      log,
    });
    log.forEach((l) => addLog(game, l));

    player.graveyard.push(...monster.equipments, monster.card);
    player.monsterZones[zoneIdx] = null;

    addLog(game, `💥 ${player.username} détruit ${monster.card.baseCard.name}`);

    game.pendingChoice = undefined;
    emitGameState(game, server);
    return {};
  }

  // ── return_to_hand — Migration .cloud ─────────────────────────────────────

  private async resolveReturnToHand(
    game: GameState,
    userId: number,
    instanceIds: string[],
    server: Server,
  ): Promise<{ error?: string }> {
    const player = getPlayerState(game, userId);
    const [instanceId] = instanceIds;

    const zoneIdx = player.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (zoneIdx === -1) {
      game.pendingChoice = undefined;
      return { error: 'Monstre allié introuvable sur le terrain' };
    }

    const monster = player.monsterZones[zoneIdx]!;

    for (const eq of monster.equipments) {
      player.hand.push(eq);
    }
    player.hand.push(monster.card);
    player.monsterZones[zoneIdx] = null;

    addLog(
      game,
      `↩️ ${player.username} retourne ${monster.card.baseCard.name} en main` +
        (monster.equipments.length > 0
          ? ` (+ ${monster.equipments.length} équipement(s) récupéré(s))`
          : ''),
    );

    game.pendingChoice = undefined;
    emitGameState(game, server);
    return {};
  }

  // ── force_attack_enemy — Rootkit de Transmission ──────────────────────────

  private async resolveForceAttackEnemy(
    game: GameState,
    userId: number,
    instanceIds: string[],
    server: Server,
  ): Promise<{ error?: string }> {
    const opponent =
      game.player1.userId === userId ? game.player2 : game.player1;
    const player = getPlayerState(game, userId);
    const [instanceId] = instanceIds;

    const monster = opponent.monsterZones.find(
      (m) => m?.instanceId === instanceId,
    );
    if (!monster) {
      game.pendingChoice = undefined;
      return { error: 'Monstre adverse introuvable' };
    }

    monster.forcedAttackMode = true;
    monster.mode = 'attack';

    addLog(
      game,
      `🔒 ${player.username} force ${monster.card.baseCard.name} en mode Attaque`,
    );

    game.pendingChoice = undefined;
    emitGameState(game, server);
    return {};
  }
}
