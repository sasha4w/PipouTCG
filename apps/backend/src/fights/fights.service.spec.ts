import { FightsService } from './fights.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import type { MatchmakingService } from './services/matchmaking.service';
import type { GameEndService } from './services/game-end.service';
import type { DecksService } from '../decks/decks.service';
import type { GameState } from './interfaces/game-state.interface';
import { createEngine } from './testing/engine';
import { fakeServer } from './testing/fake-server';
import { fillerCard } from './testing/cards';
import {
  scenario,
  waitingScenario,
  instanceOf,
  P1_ID,
  P2_ID,
} from './testing/scenario';

const OUTSIDER = 99;

function setup(game: GameState = scenario()) {
  const { server, emitted } = fakeServer();
  const decks = { loadDeckForMatch: jest.fn() };
  const gameEnd = { persistResult: jest.fn().mockResolvedValue(undefined) };
  const matchmaking = { leaveQueue: jest.fn() };
  const timer = new TurnTimeoutService();
  const engine = createEngine();
  const service = new FightsService(
    matchmaking as unknown as MatchmakingService,
    new DeckSubmissionService(decks as unknown as DecksService, engine),
    engine,
    gameEnd as unknown as GameEndService,
    timer,
  );
  service.adopt(game);
  return { service, server, emitted, decks, gameEnd, timer, game };
}

describe('FightsService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("refuse les actions d'un utilisateur étranger au match", async () => {
    const { service, server, game } = setup();
    const before = JSON.stringify(game);

    await expect(
      service.act(game.matchId, OUTSIDER, { type: 'end_phase' }, server),
    ).resolves.toEqual({ error: 'Tu ne participes pas à ce match' });
    expect(JSON.stringify(game)).toBe(before);
  });

  it("refuse l'abandon d'un utilisateur étranger au match", async () => {
    const { service, server, game, gameEnd } = setup();

    await expect(
      service.surrender(game.matchId, OUTSIDER, server),
    ).resolves.toEqual({ error: 'Tu ne participes pas à ce match' });
    expect(game.phase).toBe('main');
    expect(gameEnd.persistResult).not.toHaveBeenCalled();
  });

  it("abandon : l'adversaire gagne, le résultat est enregistré et annoncé", async () => {
    const { service, server, emitted, game, gameEnd, timer } = setup();

    await service.surrender(game.matchId, P1_ID, server);

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P2_ID);
    expect(gameEnd.persistResult).toHaveBeenCalledWith(game);
    expect(emitted.filter((e) => e.event === 'fight:game_over')).toHaveLength(
      2,
    );
    expect(timer.has(game.matchId)).toBe(false);
  });

  it("émet l'état et relance le timer après une action réussie", async () => {
    const { service, server, emitted, game, timer } = setup();

    await service.act(game.matchId, P1_ID, { type: 'end_phase' }, server);

    expect(emitted.filter((e) => e.event === 'fight:state')).toHaveLength(2);
    expect(timer.has(game.matchId)).toBe(true);
  });

  it('sérialise les soumissions de deck concurrentes', async () => {
    const { service, server, decks, game } = setup(waitingScenario());
    decks.loadDeckForMatch.mockImplementation(() =>
      Promise.resolve(
        Array.from({ length: 20 }, (_, i) =>
          instanceOf(fillerCard(`C${i}`), P1_ID),
        ),
      ),
    );

    const [first, second] = await Promise.all([
      service.submitDeck(game.matchId, P1_ID, 5, server),
      service.submitDeck(game.matchId, P1_ID, 5, server),
    ]);

    expect(first).toEqual({});
    expect(second).toEqual({ error: 'Deck déjà soumis' });
    expect(decks.loadDeckForMatch).toHaveBeenCalledTimes(1);
  });

  it("refuse la soumission de deck d'un utilisateur étranger au match", async () => {
    const { service, server, game } = setup(waitingScenario());

    await expect(
      service.submitDeck(game.matchId, OUTSIDER, 5, server),
    ).resolves.toEqual({ error: 'Tu ne participes pas à ce match' });
  });

  it('un timeout fait avancer la phase et relance le timer', async () => {
    const { service, server, game, timer } = setup();
    await service.act(game.matchId, P1_ID, { type: 'end_phase' }, server);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(game.phase).toBe('end');
    expect(timer.has(game.matchId)).toBe(true);
  });

  it('aucun timer ne tourne après la fin de la partie', async () => {
    const { service, server, game, timer } = setup();
    await service.act(game.matchId, P1_ID, { type: 'end_phase' }, server);

    await service.surrender(game.matchId, P1_ID, server);

    expect(timer.has(game.matchId)).toBe(false);
  });

  it('déconnexion puis retour sous 60 s : la partie continue sur le nouveau socket', async () => {
    const { service, server, game } = setup();
    service.handleDisconnect(P1_ID, 'socket-1', server);
    await jest.advanceTimersByTimeAsync(30_000);

    expect(service.reconnect(P1_ID, 'socket-neuf')).toEqual({
      matchId: game.matchId,
      opponentName: 'Bob',
      phase: 'main',
    });
    await jest.advanceTimersByTimeAsync(60_000);

    expect(game.phase).toBe('main');
    expect(game.player1.socketId).toBe('socket-neuf');
  });

  it('sans retour sous 60 s : défaite par déconnexion', async () => {
    const { service, server, game, gameEnd } = setup();
    service.handleDisconnect(P1_ID, 'socket-1', server);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(game).toMatchObject({
      phase: 'finished',
      winner: P2_ID,
      endReason: 'disconnect',
    });
    expect(gameEnd.persistResult).toHaveBeenCalledWith(game);
  });

  it("ignore la fermeture d'un ancien socket du joueur", async () => {
    const { service, server, game } = setup();
    service.handleDisconnect(P1_ID, 'ancien-onglet', server);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(game.phase).toBe('main');
  });
});
