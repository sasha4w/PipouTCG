import { brotliDecompressSync } from 'node:zlib';
import { monsterCard } from '../fights/testing/cards';
import { scenario } from '../fights/testing/scenario';
import { TraceWriter, snapshotState } from './trace';

describe('snapshotState', () => {
  it("garde l'état de jeu, retire journal, événements et identité réseau", () => {
    const game = scenario({ p1: { hand: [monsterCard('Recrue')] } });
    game.log.push('texte');
    game.pendingEvents.push({
      kind: 'monster_healed',
      ownerId: 1,
      zoneIndex: 0,
      instanceId: 'x',
    });

    const state = JSON.parse(snapshotState(game)) as Record<string, unknown> & {
      player1: Record<string, unknown> & { hand: unknown[] };
    };

    expect(state.log).toBeUndefined();
    expect(state.pendingEvents).toBeUndefined();
    expect(state.player1.socketId).toBeUndefined();
    expect(state.player1.username).toBeUndefined();
    expect(state.player1.userId).toBe(1);
    expect(state.player1.hand).toHaveLength(1);
  });
});

describe('TraceWriter', () => {
  it('rend un NDJSON brotli identique aux lignes écrites', async () => {
    const writer = new TraceWriter();
    const lines = Array.from({ length: 50 }, (_, i) =>
      JSON.stringify({ i, payload: 'x'.repeat(500) }),
    );
    for (const l of lines) writer.writeLine(l);

    const blob = await writer.finish();

    expect(writer.lines).toBe(50);
    expect(blob.length).toBeLessThan(lines.join('\n').length / 5);
    expect(brotliDecompressSync(blob).toString('utf8')).toBe(
      lines.join('\n') + '\n',
    );
  });

  it('abort ne lève pas et ne laisse aucun rejet non géré', async () => {
    const writer = new TraceWriter();
    writer.writeLine('{}');
    expect(() => writer.abort()).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});
