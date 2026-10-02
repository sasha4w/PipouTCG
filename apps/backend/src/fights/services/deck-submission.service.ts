import { Injectable } from '@nestjs/common';
import { DecksService } from '../../decks/decks.service';
import { GameState } from '../interfaces/game-state.interface';
import { addLog, getPlayerState, shuffle } from '../helpers/game-state.helper';

const STARTING_PRIMES = 6;
const STARTING_HAND = 5;

@Injectable()
export class DeckSubmissionService {
  constructor(private decksService: DecksService) {}

  /** Charge et installe le deck du joueur ; démarre la partie si les deux sont prêts. */
  async submitDeck(
    game: GameState,
    userId: number,
    deckId: number,
  ): Promise<{ error?: string }> {
    if (game.phase !== 'waiting') return { error: 'Le match a déjà commencé' };

    const player = getPlayerState(game, userId);
    if (player.ready) return { error: 'Deck déjà soumis' };

    let cards;
    try {
      cards = await this.decksService.loadDeckCards(deckId, userId);
    } catch {
      return { error: 'Deck invalide ou inaccessible' };
    }

    if (cards.length < 20)
      return { error: 'Le deck doit contenir au moins 20 cartes' };

    const shuffled = shuffle(cards);
    player.primeDeck = shuffled.splice(0, STARTING_PRIMES);
    player.primes = STARTING_PRIMES;
    player.deck = shuffled;
    for (let i = 0; i < STARTING_HAND; i++) {
      const c = player.deck.shift();
      if (c) player.hand.push(c);
    }
    player.ready = true;

    if (game.player1.ready && game.player2.ready) {
      game.phase = 'main';
      game.turnNumber = 1;
      addLog(game, `⚔️ Combat ! Tour 1 — ${game.player1.username} commence`);
    }
    return {};
  }
}
