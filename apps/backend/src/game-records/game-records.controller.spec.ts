import { NotFoundException, StreamableFile } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { GameRecordsController } from './game-records.controller';
import type { GameRecordsService } from './game-records.service';

function setup(trace: Buffer | null) {
  const records = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1 }),
    trace: jest.fn().mockResolvedValue(trace),
  };
  const res = { set: jest.fn() };
  const ctrl = new GameRecordsController(
    records as unknown as GameRecordsService,
  );
  return { ctrl, records, res };
}

describe('GameRecordsController', () => {
  it('réservé aux admins connectés', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      GameRecordsController,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  it('liste : dates converties, page 1 par défaut', async () => {
    const { ctrl, records } = setup(null);
    await ctrl.list({ from: '2026-11-01T00:00:00Z', mode: 'pve' });
    expect(records.list).toHaveBeenCalledWith({
      from: new Date('2026-11-01T00:00:00Z'),
      to: undefined,
      mode: 'pve',
      page: 1,
    });
  });

  it('trace servie en NDJSON brotli', async () => {
    const { ctrl, res } = setup(Buffer.from('br'));
    const file = await ctrl.trace(3, res as never);
    expect(file).toBeInstanceOf(StreamableFile);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/x-ndjson',
        'Content-Encoding': 'br',
      }),
    );
  });

  it('trace absente : 404', async () => {
    const { ctrl, res } = setup(null);
    await expect(ctrl.trace(3, res as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
