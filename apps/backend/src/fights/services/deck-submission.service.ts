import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { DecksService } from '../../decks/decks.service';
import { GameState } from '../interfaces/game-state.interface';
import { addLog, getPlayerState, shuffle, drawCard } from '../helpers/game-state.helper';
import { emitGameState } from '../helpers/client-state.builder';

const STARTING_PRIMES = 6;
const STARTING_HAND = 5;

@Injectable()
export class DeckSubmissionService {
  constructor(private decksService: DecksService) {}

  async submitDeck(
    game: GameState,
    userId: number,
    deckId: number,
    server: Server,
    onBothReady: (game: GameState, server: Server) => void,
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

    if (cards.length < 20) return { error: 'Le deck doit contenir au moins 20 cartes' };

    const shuffled = shuffle(cards);
    player.primeDeck = shuffled.splice(0, STARTING_PRIMES);
    player.primes = STARTING_PRIMES;
    player.deck = shuffled;
    for (let i = 0; i < STARTING_HAND; i++) {
      const c = player.deck.shift();
      if (c) player.hand.push(c);
    }
    player.ready = true;

    const opponent = game.player1.userId === userId ? game.player2 : game.player1;
    if (opponent.ready) {
      onBothReady(game, server);
    } else {
      server.to(player.socketId).emit('fight:deck_accepted', { matchId: game.matchId });
    }
    return {};
  }
}
