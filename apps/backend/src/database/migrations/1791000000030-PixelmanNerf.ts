import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { PIXELMAN_NERF_PATCHES } from '../pixelman-2026-11-nerf-patches';

/** Brûlure de Noyau Beta dégressive (300 puis 100) ; Module Bluetooth .v2 sur Beta à 300 ; texte de DuplicateX (copie liée à l'original). */
export class PixelmanNerf1791000000030 implements MigrationInterface {
  name = 'PixelmanNerf1791000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      PIXELMAN_NERF_PATCHES,
      'up',
      new Logger('PixelmanNerf'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      PIXELMAN_NERF_PATCHES,
      'down',
      new Logger('PixelmanNerf'),
    );
  }
}
