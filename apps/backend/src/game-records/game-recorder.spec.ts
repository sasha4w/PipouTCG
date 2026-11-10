import { Logger } from '@nestjs/common';
import { brotliDecompressSync } from 'node:zlib';
import type { GameAction, Seat } from '@pipou/shared';
import { createEngine } from '../fights/testing/engine';
import { monsterCard } from '../fights/testing/cards';
import { monsterNamed, scenario } from '../fights/testing/scenario';
import type { GameState } from '../fights/interfaces/game-state.interface';
import {
  GameRecorder,
  recorderOptions,
  type RecorderOptions,
} from './game-recorder';
import type { GameRecordStore, NewGameRecord } from './game-recorder.port';

const engine = createEngine();
const OPTIONS: RecorderOptions = {
  enabled: true,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxEntries: 3000,
  maxOpenTraces: 30,
};

function fakeStore(existingBytes = 0) {
  const saved: NewGameRecord[] = [];
  let resolveNext: (r: NewGameRecord) => void = () => undefined;
  const store = {
    save: jest.fn((r: NewGameRecord) => {
      saved.push(r);
      resolveNext(r);
      return Promise.resolve();
    }),
    totalTraceBytes: jest.fn().mockResolvedValue(existingBytes),
  } satisfies GameRecordStore;
  const next = () =>
    new Promise<NewGameRecord>((r) => {
      resolveNext = r;
    });
  return { store, saved, next };
}

function battle(): GameState {
  return scenario({
    turn: 'p1',
    phase: 'battle',
    p1: { monsters: [monsterCard('Lame', { atk: 1000, hp: 1000 })] },
    p2: { monsters: [monsterCard('Moucheron', { atk: 0, hp: 100 })] },
  });
}

function attack(game: GameState): GameAction {
  return {
    type: 'attack',
    attackerInstanceId: monsterNamed(game, 'p1', 'Lame').instanceId,
    targetInstanceId: monsterNamed(game, 'p2', 'Moucheron').instanceId,
  };
}

/** Coup joué comme FightsService : ticket, moteur, puis after si accepté. */
function play(
  rec: GameRecorder,
  game: GameState,
  seat: Seat,
  action: GameAction,
) {
  const ticket = rec.before(game, seat, action);
  const { error } = engine.dispatch(game, seat, action);
  if (ticket && !error) rec.after(game, ticket, 'human');
  return error;
}

const lines = (r: NewGameRecord) =>
  brotliDecompressSync(r.trace!)
    .toString('utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>);

describe('GameRecorder', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('partie JcJ : en-tête, coups, fin, résumé', async () => {
    const { store, next } = fakeStore();
    const rec = new GameRecorder(store, OPTIONS);
    const game = battle();
    rec.begin(game, { mode: 'pvp' });
    const action = attack(game);

    expect(play(rec, game, 'p1', action)).toBeUndefined();
    const saved = next();
    rec.finish(game);
    const r = await saved;

    expect(r).toMatchObject({
      matchId: game.matchId,
      mode: 'pvp',
      player1Id: 1,
      player2Id: 2,
      moves: 1,
      formatVersion: 1,
    });
    expect(r.traceBytes).toBe(r.trace!.length);
    const [header, move, end] = lines(r);
    expect(header).toMatchObject({ v: 1, mode: 'pvp' });
    expect(move).toMatchObject({ i: 1, seat: 'p1', by: 'human', action });
    expect((move.state as { phase: string }).phase).toBe('battle');
    expect((move.state as Record<string, unknown>).log).toBeUndefined();
    expect(end).toHaveProperty('end');
    expect(Object.values(r.summary.cards.p1)).toEqual([{ kills: 1 }]);
    expect(r.summary.seats.p1).toMatchObject({ kind: 'human', userId: 1 });
  });

  it("PvE : le siège de l'IA porte niveau, archétype et adversaire", async () => {
    const { store, next } = fakeStore();
    const rec = new GameRecorder(store, OPTIONS);
    const game = battle();
    rec.begin(game, {
      mode: 'pve',
      aiSeat: 'p2',
      level: 4,
      archetype: 'dragon',
      opponentId: 12,
    });
    const saved = next();
    rec.finish(game);
    const r = await saved;

    expect(r.player2Id).toBeNull();
    expect(r.summary.seats.p2).toMatchObject({
      kind: 'ai',
      level: 4,
      archetype: 'dragon',
      opponentId: 12,
    });
  });

  it('coup refusé par le moteur : rien enregistré', async () => {
    const { store, next } = fakeStore();
    const rec = new GameRecorder(store, OPTIONS);
    const game = battle();
    rec.begin(game, { mode: 'pvp' });

    expect(play(rec, game, 'p2', { type: 'end_phase' })).toBeDefined();
    const saved = next();
    rec.finish(game);

    expect((await saved).moves).toBe(0);
  });

  it('partie inconnue (bac à sable, test) : aucun ticket, aucun enregistrement', () => {
    const { store } = fakeStore();
    const rec = new GameRecorder(store, OPTIONS);
    const game = battle();

    expect(rec.before(game, 'p1', attack(game))).toBeNull();
    rec.finish(game);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('désactivé : rien du tout', () => {
    const { store } = fakeStore();
    const rec = new GameRecorder(store, { ...OPTIONS, enabled: false });
    const game = battle();
    rec.begin(game, { mode: 'pvp' });

    expect(rec.before(game, 'p1', attack(game))).toBeNull();
    expect(store.totalTraceBytes).not.toHaveBeenCalled();
  });

  it('plafond global atteint : résumé gardé, trace nulle', async () => {
    const { store, next } = fakeStore(10);
    const rec = new GameRecorder(store, { ...OPTIONS, maxTotalBytes: 10 });
    await new Promise((r) => setImmediate(r)); // lecture de la taille existante
    const game = battle();
    rec.begin(game, { mode: 'pvp' });
    play(rec, game, 'p1', attack(game));
    const saved = next();
    rec.finish(game);
    const r = await saved;

    expect(r.trace).toBeNull();
    expect(r.traceBytes).toBe(0);
    expect(r.moves).toBe(1);
  });

  it('plafond par partie : trace abandonnée, coups toujours comptés', async () => {
    const { store, next } = fakeStore();
    const rec = new GameRecorder(store, { ...OPTIONS, maxEntries: 1 });
    const game = scenario({ turn: 'p1', phase: 'main' });
    rec.begin(game, { mode: 'pvp' });
    play(rec, game, 'p1', { type: 'end_phase' });
    play(rec, game, 'p1', { type: 'end_phase' });
    const saved = next();
    rec.finish(game);
    const r = await saved;

    expect(r.trace).toBeNull();
    expect(r.moves).toBe(2);
  });

  it('trop de traces ouvertes : la nouvelle partie n’a que le résumé', async () => {
    const { store, next } = fakeStore();
    const rec = new GameRecorder(store, { ...OPTIONS, maxOpenTraces: 1 });
    const first = battle();
    const second = { ...battle(), matchId: 2 };
    rec.begin(first, { mode: 'pvp' });
    rec.begin(second, { mode: 'pvp' });
    const saved = next();
    rec.finish(second);

    expect((await saved).trace).toBeNull();
  });

  it('échec du store : journalisé, jamais propagé', async () => {
    const { store } = fakeStore();
    store.save.mockRejectedValueOnce(new Error('base indisponible'));
    const rec = new GameRecorder(store, OPTIONS);
    const game = battle();
    rec.begin(game, { mode: 'pvp' });

    expect(() => rec.finish(game)).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
    expect(warn).toHaveBeenCalled();
  });

  it('erreur interne : la partie continue, son enregistrement est abandonné', () => {
    const { store } = fakeStore();
    const rec = new GameRecorder(store, OPTIONS);
    const game = battle();
    rec.begin(game, { mode: 'pvp' });
    const ticket = rec.before(game, 'p1', attack(game))!;
    (game as { pendingEvents: unknown }).pendingEvents = null; // état corrompu

    expect(() => rec.after(game, ticket, 'human')).not.toThrow();
    expect(warn).toHaveBeenCalled();
    rec.finish(game);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('options lues depuis l’environnement', () => {
    expect(recorderOptions({})).toEqual({
      enabled: true,
      maxTotalBytes: 500 * 1024 * 1024,
      maxEntries: 3000,
      maxOpenTraces: 30,
    });
    expect(recorderOptions({ GAME_RECORDING: 'off' }).enabled).toBe(false);
    expect(recorderOptions({ GAME_RECORD_MAX_MB: '20' }).maxTotalBytes).toBe(
      20 * 1024 * 1024,
    );
  });
});
