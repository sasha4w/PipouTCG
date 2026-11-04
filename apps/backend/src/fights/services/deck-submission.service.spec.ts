import { BadRequestException } from '@nestjs/common';
import { DeckSubmissionService } from './deck-submission.service';
import { createGameState } from '../helpers/game-factory';
import type { DecksService } from '../../decks/decks.service';
import type { GameEngine } from '../engine/game-engine';

function setup(setupError?: string) {
  const decks = {
    loadDeckForMatch: jest.fn().mockResolvedValue([]),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
  const engine = {
    setupDeck: jest
      .fn()
      .mockReturnValue(setupError ? { error: setupError } : {}),
  };
  const svc = new DeckSubmissionService(
    decks as unknown as DecksService,
    engine as unknown as GameEngine,
  );
  const game = createGameState(
    1,
    { userId: 7, username: 'a', socketId: 's1' },
    { userId: 8, username: 'b', socketId: 's2' },
  );
  return { svc, decks, game };
}

describe('DeckSubmissionService — dernier deck utilisé', () => {
  it('marque le deck utilisé quand il est accepté', async () => {
    const { svc, decks, game } = setup();
    expect(await svc.submitDeck(game, 7, 4)).toEqual({});
    expect(decks.markUsed).toHaveBeenCalledWith(4, 7);
  });

  it('ne marque pas un deck refusé par les règles', async () => {
    const { svc, decks, game } = setup();
    decks.loadDeckForMatch.mockRejectedValue(new BadRequestException('non'));
    expect(await svc.submitDeck(game, 7, 4)).toEqual({ error: 'non' });
    expect(decks.markUsed).not.toHaveBeenCalled();
  });

  it("ne marque pas un deck refusé par l'installation", async () => {
    const { svc, decks, game } = setup('boom');
    expect(await svc.submitDeck(game, 7, 4)).toEqual({ error: 'boom' });
    expect(decks.markUsed).not.toHaveBeenCalled();
  });
});
