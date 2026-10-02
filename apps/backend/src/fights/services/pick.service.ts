import { Injectable } from '@nestjs/common';
import { GameState } from '../interfaces/game-state.interface';
import {
  addLog,
  currentChoice,
  getPlayerState,
  shuffle,
} from '../helpers/game-state.helper';

@Injectable()
export class PickService {
  /** Résout le premier choix en attente avec les cartes choisies. */
  pickCards(
    game: GameState,
    userId: number,
    instanceIds: string[],
  ): { error?: string } {
    const choice = currentChoice(game);
    if (!choice || choice.forUserId !== userId)
      return { error: 'Aucun choix de carte en attente' };

    const expected = Math.min(choice.count, choice.candidates.length);
    const picked = [...new Set(instanceIds)];
    if (picked.length !== expected)
      return { error: `Sélectionnez exactement ${expected} carte(s)` };
    if (
      picked.some((id) => !choice.candidates.some((c) => c.instanceId === id))
    )
      return { error: 'Carte introuvable dans les choix disponibles' };

    const player = getPlayerState(game, userId);

    if (choice.resolution === 'discard') {
      for (const id of picked) {
        const idx = player.hand.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = player.hand.splice(idx, 1);
        player.graveyard.push(card);
        addLog(game, `🗑️ ${player.username} défausse ${card.baseCard.name}`);
      }
    } else {
      let pickedFromDeck = false;
      for (const id of picked) {
        const candidate = choice.candidates.find((c) => c.instanceId === id)!;
        const pile =
          candidate.source === 'graveyard' ? player.graveyard : player.deck;
        const idx = pile.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = pile.splice(idx, 1);
        player.hand.push(card);
        if (candidate.source === 'deck') pickedFromDeck = true;
        addLog(
          game,
          candidate.source === 'graveyard'
            ? `📥 ${player.username} récupère ${card.baseCard.name} depuis son cimetière`
            : `🔮 ${player.username} récupère ${card.baseCard.name} depuis son deck`,
        );
      }
      if (pickedFromDeck) shuffle(player.deck);
    }

    game.pendingChoices.shift();
    return {};
  }
}
