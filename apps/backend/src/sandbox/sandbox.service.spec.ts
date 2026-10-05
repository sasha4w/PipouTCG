import type { Repository } from 'typeorm';
import type { Card } from '../cards/card.entity';
import type { SandboxDeckEntry, SandboxState } from '@pipou/shared';
import { TurnTimeoutService } from '../fights/services/turn-timeout.service';
import { createEngine } from '../fights/testing/engine';
import { monsterCard } from '../fights/testing/cards';
import {
  CLEANUP_DELAY_MS,
  SandboxService,
  UNDO_LIMIT,
  type SandboxAdmin,
} from './sandbox.service';
import type { ScenariosService } from './scenarios.service';
import type { SandboxServer } from './sandbox-socket.types';
import type { SerializedGame } from './scenario-serializer';

const ADMIN: SandboxAdmin = {
  userId: 4,
  username: 'Admin',
  socketId: 'sock-a',
};
const OTHER_ADMIN: SandboxAdmin = {
  userId: 9,
  username: 'Autre',
  socketId: 'sock-b',
};

const catalog: Card[] = Array.from({ length: 30 }, (_, i) =>
  monsterCard(`Carte ${i}`),
);
const deck = (n = 30): SandboxDeckEntry[] =>
  catalog.slice(0, n).map((c) => ({ cardId: c.id, quantity: 1 }));

function setup() {
  const states: SandboxState[] = [];
  const server = {
    to: () => ({
      emit: (event: string, payload: SandboxState) => {
        if (event === 'sandbox:state') states.push(payload);
        return true;
      },
    }),
  } as unknown as SandboxServer;
  const store = new Map<number, SerializedGame>();
  const scenarios = {
    create: jest.fn((input: { state: SerializedGame }) => {
      const id = store.size + 1;
      store.set(id, input.state);
      return Promise.resolve(id);
    }),
    findState: jest.fn((id: number) => Promise.resolve(store.get(id) ?? null)),
  };
  const cards = { findBy: jest.fn(() => Promise.resolve(catalog)) };
  const service = new SandboxService(
    createEngine(),
    scenarios as unknown as ScenariosService,
    cards as unknown as Repository<Card>,
    new TurnTimeoutService(),
  );
  const last = () => states[states.length - 1];
  return { service, server, states, last, scenarios, cards };
}

async function inGame(firstSeat: 'p1' | 'p2' = 'p1', timer = false) {
  const ctx = setup();
  await ctx.service.create(
    ADMIN,
    { decks: { p1: deck(), p2: deck() }, firstSeat, timer },
    ctx.server,
  );
  ctx.service.act(
    ADMIN.userId,
    'p1',
    { type: 'mulligan', redraw: false },
    ctx.server,
  );
  ctx.service.act(
    ADMIN.userId,
    'p2',
    { type: 'mulligan', redraw: false },
    ctx.server,
  );
  return ctx;
}

describe('SandboxService', () => {
  afterEach(() => jest.useRealTimers());

  it('crée une partie au mulligan avec le premier joueur choisi', async () => {
    const { service, server, last } = setup();

    await expect(
      service.create(
        ADMIN,
        { decks: { p1: deck(), p2: deck() }, firstSeat: 'p2', timer: false },
        server,
      ),
    ).resolves.toEqual({});

    expect(last().views.p1.phase).toBe('mulligan');
    expect(last().views.p2.isMyTurn).toBe(true);
    expect(last().decks.p1).toHaveLength(19);
    expect(last().views.p1.me.hand).toHaveLength(5);
  });

  it('refuse un deck hors règles, sans rien créer', async () => {
    const { service, server, states } = setup();

    const result = await service.create(
      ADMIN,
      { decks: { p1: deck(29), p2: deck() }, firstSeat: 'p1', timer: false },
      server,
    );

    expect(result.error).toContain('Deck J1');
    expect(result.error).toContain('entre 30 et 40');
    expect(states).toHaveLength(0);
  });

  it('joue les deux sièges avec les règles normales', async () => {
    const { service, server, last } = await inGame('p2');

    expect(last().views.p2.phase).toBe('main');
    expect(
      service.act(ADMIN.userId, 'p1', { type: 'end_phase' }, server).error,
    ).toBe("Ce n'est pas ton tour");
    expect(
      service.act(ADMIN.userId, 'p2', { type: 'end_phase' }, server),
    ).toEqual({});
    expect(last().views.p2.phase).toBe('battle');
  });

  it('annule et refait une action, sans rien écrire en base', async () => {
    const { service, server, last, scenarios } = await inGame();
    service.act(ADMIN.userId, 'p1', { type: 'end_phase' }, server);
    expect(last().views.p1.phase).toBe('battle');

    expect(service.undo(ADMIN.userId, server)).toEqual({});
    expect(last().views.p1.phase).toBe('main');
    expect(last().canRedo).toBe(true);

    service.redo(ADMIN.userId, server);
    expect(last().views.p1.phase).toBe('battle');
    expect(scenarios.create).not.toHaveBeenCalled();
  });

  it('une action refusée ne laisse aucune trace dans la pile', async () => {
    const { service, server } = await inGame();
    const before = service.get(ADMIN.userId)!.undo.length;

    service.setup(
      ADMIN.userId,
      {
        type: 'move_card',
        seat: 'p1',
        instanceId: 'inconnue',
        to: { zone: 'hand' },
      },
      server,
    );

    expect(service.get(ADMIN.userId)!.undo).toHaveLength(before);
  });

  it(`garde au plus ${UNDO_LIMIT} étapes d'annulation`, async () => {
    const { service, server } = await inGame();

    for (let i = 0; i < UNDO_LIMIT + 5; i++)
      service.setup(
        ADMIN.userId,
        { type: 'edit_player', seat: 'p1', patch: { recycleEnergy: i } },
        server,
      );

    expect(service.get(ADMIN.userId)!.undo).toHaveLength(UNDO_LIMIT);
  });

  it('sauvegarde un scénario puis le recharge chez un autre admin', async () => {
    const { service, server, last } = await inGame();
    const hand = last().views.p1.me.hand.map((c) => c.baseCard.name);

    const saved = await service.save(ADMIN.userId, { name: 'Combo test' });
    expect(saved.scenarioId).toBe(1);

    await expect(service.load(OTHER_ADMIN, 1, server)).resolves.toEqual({});
    const loaded = service.get(OTHER_ADMIN.userId)!.game;
    expect(loaded.player1.userId).toBe(OTHER_ADMIN.userId);
    expect(loaded.player2.userId).toBe(-OTHER_ADMIN.userId);
    expect(last().views.p1.me.hand.map((c) => c.baseCard.name)).toEqual(hand);
  });

  it('refuse une sauvegarde sans nom', async () => {
    const { service } = await inGame();

    expect((await service.save(ADMIN.userId, { name: '  ' })).error).toBe(
      'Donne un nom au scénario',
    );
  });

  it('supprime le sandbox 10 minutes après la déconnexion, sauf retour', async () => {
    jest.useFakeTimers();
    const { service, server } = await inGame();

    service.disconnect(ADMIN.userId, 'sock-a');
    await jest.advanceTimersByTimeAsync(CLEANUP_DELAY_MS / 2);
    expect(service.resume(ADMIN.userId, 'sock-neuf', server)).toBe(true);
    await jest.advanceTimersByTimeAsync(CLEANUP_DELAY_MS);
    expect(service.get(ADMIN.userId)).toBeDefined();

    service.disconnect(ADMIN.userId, 'sock-neuf');
    await jest.advanceTimersByTimeAsync(CLEANUP_DELAY_MS);
    expect(service.get(ADMIN.userId)).toBeUndefined();
  });

  it('le timer, activé, fait avancer la phase après 90 s', async () => {
    jest.useFakeTimers();
    const { service, last } = await inGame('p1', true);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(last().views.p1.phase).toBe('battle');
    expect(service.get(ADMIN.userId)!.undo.length).toBeGreaterThan(0);
  });
});
