import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { TEROS_PATCHES } from '../teros-2026-10-patches';

/** Nerf des Teros (PV) et dégâts divisés limités à 2 tours (Teros, Écaille de Dragon). */
export class TerosNerf1791000000021 implements MigrationInterface {
  name = 'TerosNerf1791000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      TEROS_PATCHES,
      'up',
      new Logger('TerosNerf'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyBalancePatches(
      queryRunner,
      TEROS_PATCHES,
      'down',
      new Logger('TerosNerf'),
    );
  }
}
