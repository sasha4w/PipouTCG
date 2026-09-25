import { Logger } from '@nestjs/common';
import type { FightServer } from '../fight-socket.types';
import { TurnTimeoutService } from './turn-timeout.service';
import type { GameState } from '../interfaces/game-state.interface';

function fakeGame(): GameState {
  const player = {
    userId: 1,
    hand: [],
    graveyard: [],
    monsterZones: [null],
  };
  return {
    matchId: 7,
    currentTurnUserId: 1,
    phase: 'main',
    log: [],
    player1: player,
    player2: { ...player, userId: 2 },
  } as unknown as GameState;
}

describe('TurnTimeoutService', () => {
  const server = {} as FightServer;

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should call onTimeout after the turn delay', async () => {
    const onTimeout = jest.fn().mockResolvedValue(undefined);
    new TurnTimeoutService().start(fakeGame(), server, onTimeout);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('should log a failing onTimeout instead of leaving an unhandled rejection', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const onTimeout = jest.fn().mockRejectedValue(new Error('boom'));
    new TurnTimeoutService().start(fakeGame(), server, onTimeout);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(error).toHaveBeenCalledWith(
      'Timeout du match 7 en échec',
      expect.stringContaining('boom'),
    );
  });
});
