import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DecksService } from '../../decks/decks.service';
import { GameEngine } from '../engine/game-engine';
import { CardInstance, GameState } from '../interfaces/game-state.interface';
import { seatOf, seatPlayer } from '../helpers/game-state.helper';

@Injectable()
export class DeckSubmissionService {
  private readonly logger = new Logger(DeckSubmissionService.name);

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
    const result = this.engine.setupDeck(game, seat, cards);
    if (!result.error) {
      // Simple suivi : un échec ne doit pas défaire un deck déjà installé.
      try {
        await this.decksService.markUsed(deckId, userId);
      } catch (err) {
        this.logger.warn(
          `Écriture du dernier deck utilisé impossible (deck ${deckId}, user ${userId}) : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return result;
  }
}
