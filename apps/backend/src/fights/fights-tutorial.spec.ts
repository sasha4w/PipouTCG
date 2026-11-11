import type {
  ClientGameState,
  GameAction,
  TutorialLessonId,
  TutorialResultPayload,
} from '@pipou/shared';
import { TUTORIAL_LESSONS } from '@pipou/shared';
import { FightsService, RECONNECT_GRACE_MS } from './fights.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import type { MatchmakingService } from './services/matchmaking.service';
import type { GameEndService } from './services/game-end.service';
import type { DecksService } from '../decks/decks.service';
import type { GameState } from './interfaces/game-state.interface';
import { createEngine } from './testing/engine';
import { fakeServer, type Emitted } from './testing/fake-server';
import { allRealCards } from './testing/real-cards';
import { buildLessonGame, cardResolver } from '../tutorial/lesson-board';
import { LessonRunner } from '../tutorial/lesson-runner';
import { LESSONS } from '../tutorial/lessons';
import {
  TUTORIAL_ACTION_DELAY_MS,
  type TutorialHooks,
  type TutorialStart,
} from './tutorial';

const HUMAN = 7;
const SOCKET = 'socket-humain';
const MATCH = -(1_000_000_000 + HUMAN);
const resolve = cardResolver(allRealCards());

function setup() {
  const { server, emitted } = fakeServer();
  const games = new Map<TutorialLessonId, GameState>();
  const hooks = {
    prepare: jest.fn(
      (userId: number, username: string, id: TutorialLessonId) => {
        const lesson = LESSONS[id]!;
        const game = buildLessonGame(lesson, resolve, {
          matchId: -(1_000_000_000 + userId),
          userId,
          username,
          opponentId: -(1_000_000_000 + userId),
          opponentName: 'Maître Pipou',
        });
        games.set(id, game);
        const start: TutorialStart = {
          lessonId: id,
          game,
          runner: new LessonRunner(lesson),
        };
        return Promise.resolve(start);
      },
    ),
    recordResult: jest.fn(
      (userId: number, lessonId: TutorialLessonId, completed: boolean) =>
        Promise.resolve<TutorialResultPayload>({
          lessonId,
          completed,
          firstCompletion: completed,
          gold: completed ? 100 : 0,
          xp: completed ? 50 : 0,
        }),
    ),
  } satisfies TutorialHooks;
  const timer = new TurnTimeoutService();
  const schedule = jest.spyOn(timer, 'schedule');
  const engine = createEngine();
  const service = new FightsService(
    {
      leaveQueue: jest.fn(),
      isQueued: jest.fn().mockReturnValue(false),
    } as unknown as MatchmakingService,
    new DeckSubmissionService({} as unknown as DecksService, engine),
    engine,
    { persistResult: jest.fn() } as unknown as GameEndService,
    timer,
    undefined,
    undefined,
    undefined,
    hooks,
  );
  const begin = (id: TutorialLessonId = 'first-turn') =>
    service.startTutorial(HUMAN, 'Alice', SOCKET, { lessonId: id }, server);
  const act = (action: GameAction) => service.act(MATCH, HUMAN, action, server);
  const ack = () => service.tutorialAck(MATCH, HUMAN, server);
  const states = (): ClientGameState[] =>
    emitted
      .filter((e) => e.event === 'fight:state' && e.room === SOCKET)
      .map((e) => e.payload as ClientGameState);
  const lastState = () => states().at(-1)!;
  const overs = (): Emitted[] =>
    emitted.filter((e) => e.event === 'fight:game_over');

  /** Joue la leçon en entier par le service, comme le ferait un élève. */
  async function playThrough(id: TutorialLessonId) {
    const lesson = LESSONS[id]!;
    const game = games.get(id)!;
    const mirror = new LessonRunner(lesson);
    while (!mirror.done) {
      const step = mirror.step!;
      const label = `${id} / ${step.key}`;
      if (step.kind === 'info') {
        expect({ label, ...(await ack()) }).toEqual({ label });
      } else if (step.kind === 'player') {
        const res = await act(mirror.expectedAction(game, 'p1')!);
        if (step.refused)
          expect({ label, ok: !res.error }).toEqual({ label, ok: false });
        else expect({ label, ...res }).toEqual({ label });
      } else {
        await jest.advanceTimersByTimeAsync(TUTORIAL_ACTION_DELAY_MS);
      }
      mirror.advance();
    }
  }
  return {
    service,
    server,
    emitted,
    hooks,
    timer,
    schedule,
    begin,
    act,
    ack,
    states,
    lastState,
    overs,
    games,
    playThrough,
  };
}

describe('FightsService — leçons du tutoriel', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('lance une leçon : partie annoncée, première étape envoyée au joueur', async () => {
    const t = setup();
    expect(await t.begin()).toEqual({});
    expect(t.emitted.find((e) => e.event === 'fight:matched')).toMatchObject({
      room: SOCKET,
      payload: {
        matchId: MATCH,
        tutorialLessonId: 'first-turn',
      },
    });
    expect(t.lastState().tutorial).toMatchObject({
      lessonId: 'first-turn',
      index: 0,
      kind: 'info',
      textKey: 'tutorial.first-turn.goal',
    });
    expect(t.lastState().me.hand.length).toBeGreaterThan(0);
  });

  it('refuse une leçon inconnue ou une seconde partie', async () => {
    const t = setup();
    expect(
      await t.service.startTutorial(
        HUMAN,
        'Alice',
        SOCKET,
        { lessonId: 'sleep' as TutorialLessonId },
        t.server,
      ),
    ).toEqual({ error: 'Leçon introuvable' });
    await t.begin();
    expect(await t.begin('combat')).toEqual({
      error: 'Tu as déjà une partie en cours',
    });
  });

  it("refuse toute action pendant une explication, jusqu'à « Suivant »", async () => {
    const t = setup();
    await t.begin();
    const before = t.states().length;
    expect(await t.act({ type: 'end_phase' })).toEqual({
      error: "Lis l'explication, puis clique sur Suivant",
    });
    expect(t.states()).toHaveLength(before);
    expect(await t.ack()).toEqual({});
    expect(t.lastState().tutorial?.index).toBe(1);
  });

  it("n'avance pas sur « Suivant » quand la leçon attend une action", async () => {
    const t = setup();
    await t.begin();
    await t.ack();
    await t.ack();
    expect(t.lastState().tutorial).toMatchObject({ kind: 'player' });
    const index = t.lastState().tutorial!.index;
    expect(await t.ack()).toEqual({
      error: 'Cette étape demande une action, pas un clic sur Suivant',
    });
    expect(t.lastState().tutorial!.index).toBe(index);
  });

  it('refuse une autre action que celle demandée, sans toucher à la partie', async () => {
    const t = setup();
    await t.begin();
    await t.ack();
    await t.ack();
    // Étape « recycler Recrue Andouille » : on tente d'en recycler une autre
    const game = t.games.get('first-turn')!;
    const hand = game.player1.hand.map((c) => c.baseCard.name);
    const wrong = hand.indexOf('Lieutenant Bidouille');
    const before = JSON.stringify(game.player1.hand);
    expect(await t.act({ type: 'recycle', handIndex: wrong })).toEqual({
      error: "Ce n'est pas l'action demandée par la leçon",
    });
    expect(await t.act({ type: 'end_phase' })).toEqual({
      error: "Ce n'est pas l'action demandée par la leçon",
    });
    expect(JSON.stringify(game.player1.hand)).toBe(before);
    expect(game.player1.recycleEnergy).toBe(0);
    expect(t.lastState().tutorial!.hint?.cards).toHaveLength(1);

    const right = hand.indexOf('Recrue Andouille');
    expect(await t.act({ type: 'recycle', handIndex: right })).toEqual({});
    expect(game.player1.recycleEnergy).toBe(1);
  });

  it("l'adversaire scripté joue seul après un délai", async () => {
    const t = setup();
    await t.begin();
    const game = t.games.get('first-turn')!;
    const mirror = new LessonRunner(LESSONS['first-turn']!);
    // Jusqu'à la fin du tour du joueur
    while (mirror.step?.kind !== 'opponent') {
      const step = mirror.step!;
      if (step.kind === 'info') await t.ack();
      else await t.act(mirror.expectedAction(game, 'p1')!);
      mirror.advance();
    }
    expect(t.lastState().tutorial?.kind).toBe('opponent');
    expect(game.player2.monsterZones.some(Boolean)).toBe(false);
    await jest.advanceTimersByTimeAsync(TUTORIAL_ACTION_DELAY_MS - 1);
    expect(game.player2.recycleEnergy).toBe(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(game.player2.recycleEnergy).toBe(1);
    await jest.advanceTimersByTimeAsync(TUTORIAL_ACTION_DELAY_MS);
    expect(game.player2.monsterZones.some(Boolean)).toBe(true);
  });

  it("n'arme aucun minuteur de tour pendant une leçon", async () => {
    const t = setup();
    await t.begin();
    await t.ack();
    await t.ack();
    expect(t.schedule).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10 * 60_000);
    expect(t.lastState().tutorial?.index).toBe(2);
  });

  it('abandonner quitte sans récompense', async () => {
    const t = setup();
    await t.begin();
    await t.service.surrender(MATCH, HUMAN, t.server);
    expect(t.hooks.recordResult).toHaveBeenCalledWith(
      HUMAN,
      'first-turn',
      false,
    );
    expect(t.overs()).toHaveLength(1);
    expect(t.overs()[0].payload).toMatchObject({
      tutorial: { lessonId: 'first-turn', completed: false, gold: 0 },
    });
    // La partie est libérée : on peut relancer une leçon
    expect(await t.begin()).toEqual({});
  });

  it('une déconnexion plus longue que le délai de grâce abandonne la leçon', async () => {
    const t = setup();
    await t.begin();
    t.service.handleDisconnect(HUMAN, SOCKET, t.server);
    await jest.advanceTimersByTimeAsync(RECONNECT_GRACE_MS + 1);
    expect(t.hooks.recordResult).toHaveBeenCalledWith(
      HUMAN,
      'first-turn',
      false,
    );
  });

  it('une reconnexion retrouve la leçon et son étape', async () => {
    const t = setup();
    await t.begin();
    await t.ack();
    t.service.handleDisconnect(HUMAN, SOCKET, t.server);
    const back = t.service.reconnect(HUMAN, 'nouveau-socket');
    expect(back).toMatchObject({
      matchId: MATCH,
      tutorialLessonId: 'first-turn',
    });
    t.service.emitState(MATCH, t.server);
    const resumed = t.emitted
      .filter((e) => e.room === 'nouveau-socket' && e.event === 'fight:state')
      .map((e) => e.payload as ClientGameState)
      .at(-1);
    expect(resumed?.tutorial).toMatchObject({
      lessonId: 'first-turn',
      index: 1,
    });
    // L'adversaire n'est pas affecté par la déconnexion
    await jest.advanceTimersByTimeAsync(RECONNECT_GRACE_MS + 1);
    expect(t.hooks.recordResult).not.toHaveBeenCalled();
  });

  it('refuse le tutoriel quand il est indisponible', async () => {
    const { server } = fakeServer();
    const engine = createEngine();
    const service = new FightsService(
      {} as unknown as MatchmakingService,
      new DeckSubmissionService({} as unknown as DecksService, engine),
      engine,
      {} as unknown as GameEndService,
      new TurnTimeoutService(),
    );
    expect(
      await service.startTutorial(
        HUMAN,
        'A',
        SOCKET,
        { lessonId: 'combat' },
        server,
      ),
    ).toEqual({ error: 'Tutoriel indisponible' });
  });

  describe.each(TUTORIAL_LESSONS)(
    'leçon %s jouée en entier par le service',
    (id) => {
      it('se termine par un résultat complété, payé une fois', async () => {
        const t = setup();
        expect(await t.begin(id)).toEqual({});
        await t.playThrough(id);
        expect(t.hooks.recordResult).toHaveBeenCalledTimes(1);
        expect(t.hooks.recordResult).toHaveBeenCalledWith(HUMAN, id, true);
        expect(t.overs()).toHaveLength(1);
        expect(t.overs()[0]).toMatchObject({
          room: SOCKET,
          payload: {
            tutorial: { lessonId: id, completed: true, firstCompletion: true },
          },
        });
      });
    },
  );
});
