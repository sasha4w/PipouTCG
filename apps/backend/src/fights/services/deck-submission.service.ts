import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DecksService } from '../../decks/decks.service';
import { GameEngine } from '../engine/game-engine';
import { CardInstance, GameState } from '../interfaces/game-state.interface';
import { seatOf, seatPlayer } from '../helpers/game-state.helper';

@Injectable()
export class DeckSubmissionService {
  constructor(
    private decksService: DecksService,
    private engine: GameEngine,
  ) {}

  /** Charge, valide et installe le deck du joueur. */
  async submitDeck(
    game: GameState,
    userId: number,
    deckId: number,
  ): Promise<{ error?: string }> {
    const seat = seatOf(game, userId);
    if (!seat) return { error: 'Tu ne participes pas à ce match' };
    if (game.phase !== 'waiting') return { error: 'Le match a déjà commencé' };
    if (seatPlayer(game, seat).ready) return { error: 'Deck déjà soumis' };

    let cards: CardInstance[];
    try {
      cards = await this.decksService.loadDeckForMatch(deckId, userId);
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      )
        return { error: err.message };
      return { error: 'Deck invalide ou inaccessible' };
    }
    return this.engine.setupDeck(game, seat, cards);
  }
}
