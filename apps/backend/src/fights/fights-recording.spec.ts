import { brotliDecompressSync } from 'node:zlib';
import { FightsService } from './fights.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import type { MatchmakingService } from './services/matchmaking.service';
import type { GameEndService } from './services/game-end.service';
import type { DecksService } from '../decks/decks.service';
import { createEngine } from './testing/engine';
import { fakeServer } from './testing/fake-server';
import { P1_ID, scenario } from './testing/scenario';
import { GameRecorder } from '../game-records/game-recorder';
import type { NewGameRecord } from '../game-records/game-recorder.port';

describe('FightsService — enregistrement JcJ', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('partie trouvée, coups joués puis abandon : une ligne avec les coups humains', async () => {
    const { server } = fakeServer();
    const game = scenario({ turn: 'p1', phase: 'main' });
    const matchmaking = {
      joinQueue: jest.fn().mockResolvedValue({ matchId: game.matchId }),
      buildInitialGameState: jest.fn().mockReturnValue(game),
      leaveQueue: jest.fn(),
    };
    let saved!: (r: NewGameRecord) => void;
    const record = new Promise<NewGameRecord>((r) => (saved = r));
    const recorder = new GameRecorder(
      {
        save: (r) => {
          saved(r);
          return Promise.resolve();
        },
        totalTraceBytes: () => Promise.resolve(0),
      },
      {
        enabled: true,
        maxTotalBytes: 1e9,
        maxEntries: 3000,
        maxOpenTraces: 30,
      },
    );
    const engine = createEngine();
    const service = new FightsService(
      matchmaking as unknown as MatchmakingService,
      new DeckSubmissionService({} as DecksService, engine),
      engine,
      {
        persistResult: jest.fn().mockResolvedValue(undefined),
      } as unknown as GameEndService,
      new TurnTimeoutService(),
      undefined,
      undefined,
      recorder,
    );

    await service.joinQueue(P1_ID, 'Alice', 's1');
    await service.act(game.matchId, P1_ID, { type: 'end_phase' }, server);
    await service.act(
      game.matchId,
      P1_ID,
      { type: 'mulligan', redraw: true },
      server,
    ); // refusé
    await service.surrender(game.matchId, P1_ID, server);
    const r = await record;

    expect(r).toMatchObject({
      mode: 'pvp',
      winnerSeat: 'p2',
      endReason: 'surrender',
      moves: 1,
    });
    const lines = brotliDecompressSync(r.trace!)
      .toString('utf8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(3); // en-tête, end_phase, fin
    expect(JSON.parse(lines[1])).toMatchObject({
      by: 'human',
      action: { type: 'end_phase' },
    });
  });
});
