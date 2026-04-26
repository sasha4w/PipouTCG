import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameState } from '../interfaces/game-state.interface';
import { addLog, getPlayerState, shuffle } from '../helpers/game-state.helper';
import { emitGameState } from '../helpers/client-state.builder';

@Injectable()
export class PickService {
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

    const player = getPlayerState(game, userId);
    let pickedFromDeck = false;

    for (const instanceId of instanceIds) {
      const candidate = choice.candidates.find((c) => c.instanceId === instanceId);
      if (!candidate) return { error: `Carte introuvable dans les choix disponibles` };

      if (candidate.source === 'graveyard') {
        const idx = player.graveyard.findIndex((c) => c.instanceId === instanceId);
        if (idx !== -1) {
          const [card] = player.graveyard.splice(idx, 1);
          player.hand.push(card);
          addLog(game, `📥 ${player.username} récupère ${candidate.baseCard.name} depuis son cimetière`);
        }
      } else {
        const idx = player.deck.findIndex((c) => c.instanceId === instanceId);
        if (idx !== -1) {
          const [card] = player.deck.splice(idx, 1);
          player.hand.push(card);
          pickedFromDeck = true;
          addLog(game, `🔮 ${player.username} récupère ${candidate.baseCard.name} depuis son deck`);
        }
      }
    }

    if (pickedFromDeck) {
      player.deck = shuffle([...player.deck]);
    }

    game.pendingChoice = undefined;
    emitGameState(game, server);
    return {};
  }
}
