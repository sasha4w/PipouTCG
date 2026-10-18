import { BadRequestException } from '@nestjs/common';
import type {
  AdventureResultPayload,
  ClientGameState,
  GameAction,
} from '@pipou/shared';
import { FightsService } from './fights.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import type { MatchmakingService } from './services/matchmaking.service';
import type { GameEndService } from './services/game-end.service';
import type { DecksService } from '../decks/decks.service';
import type { Card } from '../cards/card.entity';
import type { GameState } from './interfaces/game-state.interface';
import { AiPlayer } from './ai/ai-player';
import { createEngine } from './testing/engine';
import { fakeServer, type Emitted } from './testing/fake-server';
import { fillerCard, monsterCard } from './testing/cards';
import { instanceOf } from './testing/scenario';
import {
  AI_ACTION_DELAY_MS,
  AI_MAX_ACTIONS_PER_TURN,
  type PveHooks,
  type PveInfo,
  type PveStart,
} from './pve';

const HUMAN = 7;
const HUMAN_SOCKET = 'socket-humain';
const ADVENTURE_MATCH = 5;
const MATCH = -ADVENTURE_MATCH;
const AI = MATCH;
const OPPONENT = 12;
const TURN_MS = 90_000;

const RESULT: AdventureResultPayload = {
  opponentId: OPPONENT,
  worldId: 1,
  won: false,
  firstWin: false,
  loot: null,
  worldCompleted: false,
  unlockedWorldIds: [],
};

interface Recorded {
  winner: number | undefined;
  endReason: string | undefined;
  log: string[];
  aiOwners: number[];
  pve: PveInfo;
}

function humanDeck() {
  return Array.from({ length: 20 }, (_, i) =>
    instanceOf(fillerCard(`H${i}`), HUMAN),
  );
}

function setup(aiCard: () => Card = () => fillerCard('Sbire')) {
  const { server, emitted } = fakeServer();
  const decks = { loadDeckForMatch: jest.fn().mockResolvedValue(humanDeck()) };
  const gameEnd = { persistResult: jest.fn().mockResolvedValue(undefined) };
  const matchmaking = {
    leaveQueue: jest.fn(),
    isQueued: jest.fn().mockReturnValue(false),
  };
  const timer = new TurnTimeoutService();
  const engine = createEngine();
  const recorded: Recorded[] = [];
  const start: PveStart = {
    adventureMatchId: ADVENTURE_MATCH,
    opponentId: OPPONENT,
    opponentName: 'Gobelin',
    profile: { archetype: 'pipou', level: 3 },
    aiCards: Array.from({ length: 20 }, () => instanceOf(aiCard(), 0)),
  };
  const hooks = {
    prepareStart: jest.fn().mockResolvedValue(start),
    recordResult: jest.fn((game: GameState, pve: PveInfo) => {
      const p2 = game.player2;
      recorded.push({
        winner: game.winner,
        endReason: game.endReason,
        log: [...game.log],
        aiOwners: [...p2.hand, ...p2.deck, ...p2.primeDeck].map(
          (c) => c.ownerId,
        ),
        pve: { ...pve },
      });
      return Promise.resolve(RESULT);
    }),
  } satisfies PveHooks;
  const service = new FightsService(
    matchmaking as unknown as MatchmakingService,
    new DeckSubmissionService(decks as unknown as DecksService, engine),
    engine,
    gameEnd as unknown as GameEndService,
    timer,
    hooks,
  );
  const begin = () =>
    service.startAdventure(
      HUMAN,
      'Alice',
      HUMAN_SOCKET,
      { opponentId: OPPONENT, deckId: 3 },
      server,
    );
  const act = (action: GameAction) => service.act(MATCH, HUMAN, action, server);
  return {
    service,
    server,
    emitted,
    decks,
    hooks,
    gameEnd,
    matchmaking,
    timer,
    engine,
    recorded,
    begin,
    act,
  };
}

function humanState(emitted: Emitted[]): ClientGameState {
  const states = emitted.filter(
    (e) => e.room === HUMAN_SOCKET && e.event === 'fight:state',
  );
  return states[states.length - 1].payload as ClientGameState;
}

/** Fait avancer le temps par pas jusqu'à ce que `done` soit vrai. */
async function advanceUntil(done: () => boolean, maxMs: number) {
  for (let t = 0; t < maxMs && !done(); t += AI_ACTION_DELAY_MS)
    await jest.advanceTimersByTimeAsync(AI_ACTION_DELAY_MS);
}

const timeoutLogs = (log: string[]) =>
  log.filter((l) => l.startsWith('⏱️')).length;

/** Mulligan des deux côtés puis fin de tour humaine : l'IA a la main. */
async function toAiTurn(
  ctx: ReturnType<typeof setup>,
): Promise<ClientGameState> {
  await ctx.begin();
  await ctx.act({ type: 'mulligan', redraw: false });
  await advanceUntil(
    () => humanState(ctx.emitted).opponent.mulliganDone,
    10_000,
  );
  for (let i = 0; i < 5 && humanState(ctx.emitted).isMyTurn; i++)
    await ctx.act({ type: 'end_phase' });
  const state = humanState(ctx.emitted);
  expect(state.isMyTurn).toBe(false);
  return state;
}

describe('FightsService — parties PvE', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('startAdventure : partie en mulligan, annoncée avec l’adversaire PvE', async () => {
    const { begin, emitted, hooks } = setup();

    await expect(begin()).resolves.toEqual({});

    expect(hooks.prepareStart).toHaveBeenCalledWith(HUMAN, OPPONENT);
    const matched = emitted.find((e) => e.event === 'fight:matched')!;
    expect(matched.room).toBe(HUMAN_SOCKET);
    expect(matched.payload).toEqual({
      matchId: MATCH,
      opponentName: 'Gobelin',
      adventureOpponentId: OPPONENT,
    });
    expect(MATCH).toBeLessThan(0);
    const state = humanState(emitted);
    expect(state.phase).toBe('mulligan');
    expect(state.opponent.userId).toBe(AI);
    expect(emitted.indexOf(matched)).toBeLessThan(
      emitted.findIndex((e) => e.event === 'fight:state'),
    );
  });

  it('refuse un second démarrage du même joueur', async () => {
    const { begin, hooks } = setup();
    await begin();

    const second = await begin();

    expect(second.error).toBeDefined();
    expect(hooks.prepareStart).toHaveBeenCalledTimes(1);
  });

  it('refuse les démarrages concurrents du même joueur', async () => {
    const { begin, hooks } = setup();

    const [a, b] = await Promise.all([begin(), begin()]);

    expect([a.error, b.error].filter(Boolean)).toHaveLength(1);
    expect(hooks.prepareStart).toHaveBeenCalledTimes(1);
  });

  it('refuse un joueur en file JcJ', async () => {
    const { begin, hooks, matchmaking } = setup();
    matchmaking.isQueued.mockReturnValue(true);

    expect((await begin()).error).toBeDefined();
    expect(hooks.prepareStart).not.toHaveBeenCalled();
  });

  it('sans hooks PvE : Mode Aventure indisponible', async () => {
    const { server } = fakeServer();
    const service = new FightsService(
      {} as MatchmakingService,
      {} as DeckSubmissionService,
      createEngine(),
      {} as GameEndService,
      new TurnTimeoutService(),
    );

    await expect(
      service.startAdventure(
        HUMAN,
        'Alice',
        HUMAN_SOCKET,
        { opponentId: OPPONENT, deckId: 3 },
        server,
      ),
    ).resolves.toEqual({ error: 'Mode Aventure indisponible' });
  });

  it('deck humain invalide : erreur, aucun combat préparé', async () => {
    const ctx = setup();
    ctx.decks.loadDeckForMatch.mockRejectedValue(
      new BadRequestException('Deck invalide'),
    );

    await expect(ctx.begin()).resolves.toEqual({ error: 'Deck invalide' });
    expect(ctx.hooks.prepareStart).not.toHaveBeenCalled();
    expect(ctx.service.reconnect(HUMAN, 'x')).toBeNull();
    // Le joueur peut réessayer
    ctx.decks.loadDeckForMatch.mockResolvedValue(humanDeck());
    await expect(ctx.begin()).resolves.toEqual({});
  });

  it("l'IA joue seule son mulligan puis son tour, et rend la main", async () => {
    const ctx = setup(() => monsterCard('Sbire', { cost: 0 }));
    const { emitted, timer, recorded } = ctx;
    const before = await toAiTurn(ctx);
    expect(timer.has(MATCH)).toBe(false);

    await advanceUntil(() => humanState(emitted).isMyTurn, 120_000);

    const after = humanState(emitted);
    expect(after.isMyTurn).toBe(true);
    expect(after.turnNumber).toBe(before.turnNumber + 1);
    expect(after.opponent.monsterZones.some(Boolean)).toBe(true);
    expect(timer.has(MATCH)).toBe(true);
    expect(recorded).toHaveLength(0);
  });

  it('le moteur refuse les coups de l’IA : elle finit ses phases', async () => {
    const ctx = setup();
    await toAiTurn(ctx);
    jest
      .spyOn(AiPlayer.prototype, 'chooseAction')
      .mockReturnValue({ type: 'discard', handIndex: 99 });

    await advanceUntil(() => humanState(ctx.emitted).isMyTurn, 60_000);

    expect(humanState(ctx.emitted).isMyTurn).toBe(true);
    expect(humanState(ctx.emitted).phase).toBe('main');
  });

  it(`plafond de ${AI_MAX_ACTIONS_PER_TURN} actions IA par tour`, async () => {
    const ctx = setup(() => monsterCard('Sbire', { cost: 0 }));
    await toAiTurn(ctx);
    // IA qui bascule sans fin le mode de son monstre (rien ne l'interdit)
    const real = new AiPlayer(ctx.engine, Math.random);
    const decide = real.chooseAction.bind(real);
    let toggles = 0;
    jest
      .spyOn(AiPlayer.prototype, 'chooseAction')
      .mockImplementation((game, seat, profile) => {
        const own = game.player2.monsterZones.find(Boolean);
        if (own && game.phase === 'main') {
          toggles++;
          return {
            type: 'change_mode',
            instanceId: own.instanceId,
            mode: own.mode,
          };
        }
        return decide(game, seat, profile);
      });

    await advanceUntil(
      () => humanState(ctx.emitted).isMyTurn,
      (AI_MAX_ACTIONS_PER_TURN + 20) * AI_ACTION_DELAY_MS,
    );

    expect(humanState(ctx.emitted).isMyTurn).toBe(true);
    expect(toggles).toBeGreaterThan(AI_MAX_ACTIONS_PER_TURN / 2);
    expect(toggles).toBeLessThanOrEqual(AI_MAX_ACTIONS_PER_TURN);
  });

  it('3 timeouts humains consécutifs : défaite par abandon', async () => {
    const { begin, recorded, hooks } = setup();
    await begin();

    await advanceUntil(() => recorded.length > 0, 10 * TURN_MS);

    expect(hooks.recordResult).toHaveBeenCalledTimes(1);
    expect(recorded[0].winner).toBe(AI);
    expect(recorded[0].endReason).toBe('surrender');
    expect(timeoutLogs(recorded[0].log)).toBe(2);
    expect(recorded[0].pve).toMatchObject({
      adventureMatchId: ADVENTURE_MATCH,
      opponentId: OPPONENT,
      aiUserId: AI,
      timeouts: 3,
    });
    expect(recorded[0].aiOwners.every((id) => id === AI)).toBe(true);
  });

  it('une action humaine remet le compteur de timeouts à zéro', async () => {
    const { begin, act, recorded, emitted } = setup();
    await begin();
    // Timeout 1 (mulligan), timeout 2 (main → combat)
    await jest.advanceTimersByTimeAsync(2 * TURN_MS + 2 * AI_ACTION_DELAY_MS);
    expect(humanState(emitted).phase).toBe('battle');

    await expect(act({ type: 'end_phase' })).resolves.toEqual({});
    await advanceUntil(() => recorded.length > 0, 20 * TURN_MS);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].endReason).toBe('surrender');
    // 2 avant l'action, puis 2 appliqués + le 3e qui termine
    expect(timeoutLogs(recorded[0].log)).toBe(4);
  });

  it('abandon pendant un coup IA programmé : un seul résultat, plus aucune action IA', async () => {
    const { begin, service, server, engine, recorded, emitted } = setup();
    await begin();
    const dispatch = jest.spyOn(engine, 'dispatch');

    await service.surrender(MATCH, HUMAN, server);
    const emittedAfter = emitted.length;
    await jest.advanceTimersByTimeAsync(5 * TURN_MS);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].winner).toBe(AI);
    expect(dispatch).not.toHaveBeenCalled();
    expect(emitted.length).toBe(emittedAfter);
  });

  it('fin PvE : pas de persistance JcJ, game_over au seul humain avec le butin', async () => {
    const { begin, service, server, gameEnd, emitted } = setup();
    await begin();

    await service.surrender(MATCH, HUMAN, server);

    expect(gameEnd.persistResult).not.toHaveBeenCalled();
    const over = emitted.filter((e) => e.event === 'fight:game_over');
    expect(over).toHaveLength(1);
    expect(over[0].room).toBe(HUMAN_SOCKET);
    expect(over[0].payload).toEqual({
      winner: AI,
      endReason: 'surrender',
      adventure: RESULT,
    });
    expect(service.reconnect(HUMAN, 'x')).toBeNull();
  });

  it('recordResult en échec : game_over sans butin', async () => {
    const { begin, service, server, emitted, hooks } = setup();
    hooks.recordResult.mockRejectedValueOnce(new Error('BDD'));
    await begin();

    await service.surrender(MATCH, HUMAN, server);

    const over = emitted.find((e) => e.event === 'fight:game_over')!;
    expect(over.payload).toEqual({ winner: AI, endReason: 'surrender' });
  });

  it('reconnexion : renvoie adventureOpponentId', async () => {
    const { begin, service } = setup();
    await begin();

    expect(service.reconnect(HUMAN, 'socket-neuf')).toEqual({
      matchId: MATCH,
      opponentName: 'Gobelin',
      phase: 'mulligan',
      adventureOpponentId: OPPONENT,
    });
  });
});
