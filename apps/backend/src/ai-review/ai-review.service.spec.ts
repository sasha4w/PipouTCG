import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { gunzipSync } from 'node:zlib';
import { createEngine } from '../fights/testing/engine';
import { monsterCard } from '../fights/testing/cards';
import { scenario } from '../fights/testing/scenario';
import { AiPlayer } from '../fights/ai/ai-player';
import type { DecisionRecord } from '../fights/ai/decision-log';
import type { AiAnnotation } from './ai-annotation.entity';
import type { AiDecision } from './ai-decision.entity';
import { AiReviewService } from './ai-review.service';

const engine = createEngine();

function oneRecord(): DecisionRecord {
  const game = scenario({
    turn: 'p2',
    phase: 'battle',
    p1: { monsters: [monsterCard('Moucheron', { atk: 0, hp: 100 })] },
    p2: { primes: 1, monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] },
  });
  const records: DecisionRecord[] = [];
  const ai = new AiPlayer(engine, () => 0.99);
  ai.setDecisionSink((r) => records.push(r), 'pve123');
  ai.chooseAction(game, 'p2', { archetype: 'pipou', level: 3 });
  return records[0];
}

function service() {
  const insert = jest.fn().mockResolvedValue(undefined);
  const decisions = {
    insert,
    findOneBy: jest.fn(),
  } as unknown as Repository<AiDecision>;
  const save = jest.fn((x: unknown) =>
    Promise.resolve({ id: 1, createdAt: new Date(0), ...(x as object) }),
  );
  const annotations = {
    create: (x: unknown) => x,
    save,
  } as unknown as Repository<AiAnnotation>;
  return {
    svc: new AiReviewService(decisions, annotations),
    insert,
    save,
    decisions,
  };
}

describe('AiReviewService', () => {
  it('pas de sink pour un joueur non admin', () => {
    expect(service().svc.sinkFor(1, false)).toBeNull();
  });

  it('le sink enregistre la décision, l’état compressé et la partie', async () => {
    const { svc, insert } = service();
    const record = oneRecord();

    svc.sinkFor(7, true)!(record);
    await new Promise((r) => setImmediate(r));

    expect(insert).toHaveBeenCalledTimes(1);
    const [[row]] = insert.mock.calls as [Record<string, unknown>][];
    expect(row.id).toBe(record.id);
    expect(row.gameId).toBe(`pve123:${record.matchId}`);
    expect(row.userId).toBe(7);
    expect(row.chosenText).toContain('Lame');
    const state = JSON.parse(
      gunzipSync(row.stateGz as Buffer).toString('utf8'),
    ) as { phase: string };
    expect(state.phase).toBe('battle');
  });

  it('un insert qui échoue ne remonte pas à l’IA', async () => {
    const { svc, insert } = service();
    insert.mockRejectedValue(new Error('base indisponible'));

    expect(() => svc.sinkFor(7, true)!(oneRecord())).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });

  it('annotate : refuse un candidat préféré inexistant', async () => {
    const { svc, decisions } = service();
    (decisions.findOneBy as jest.Mock).mockResolvedValue({
      id: 'd',
      candidates: [{ action: { type: 'end_phase' }, score: 1 }],
    });

    await expect(
      svc.annotate(1, 'd', { verdict: 'better_action', preferredIndex: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('annotate : better_action sans coup préféré est refusé', async () => {
    const { svc, decisions } = service();
    (decisions.findOneBy as jest.Mock).mockResolvedValue({
      id: 'd',
      candidates: [],
    });

    await expect(
      svc.annotate(1, 'd', { verdict: 'better_action' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('annotate : enregistre le coup préféré choisi par index', async () => {
    const { svc, decisions, save } = service();
    (decisions.findOneBy as jest.Mock).mockResolvedValue({
      id: 'd',
      candidates: [
        { action: { type: 'end_phase' }, score: 1 },
        { action: { type: 'mulligan', redraw: true }, score: 0 },
      ],
    });

    const out = await svc.annotate(9, 'd', {
      verdict: 'better_action',
      preferredIndex: 1,
      category: 'lookahead',
      comment: '  menace létale ',
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(out.preferred).toEqual({ type: 'mulligan', redraw: true });
    expect(out.comment).toBe('menace létale');
    expect(out.category).toBe('lookahead');
  });
});
